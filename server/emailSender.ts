import * as db from "./db";
import type { Campaign } from "../drizzle/schema";
import { shuffle, signTrackingToken } from "./security";
import { dispatchEmail } from "./email/providers";

export { dispatchEmail };

/**
 * Email sending pipeline.
 *
 * Builds the final per-recipient message (variant-aware for A/B tests),
 * injects tracking (open pixel, click redirects, unsubscribe link) and
 * dispatches through the organization's configured SMTP provider.
 *
 * Provider dispatch is implemented for SendGrid/Mailgun/SES via their HTTP
 * APIs when an API key is configured. When no provider is configured, the
 * message is marked as sent in "sandbox mode" so the full flow (variants,
 * tracking, metrics) remains testable end-to-end.
 */

export type RenderedEmail = {
  subject: string;
  html: string;
  text: string;
  variant: "a" | "b";
};

function getBaseUrl(): string {
  // Prefer explicit origin; fall back to relative paths (tracking routes are same-origin)
  return process.env.PUBLIC_ORIGIN || "";
}

/**
 * Pick the subject/content for a recipient according to the campaign's
 * A/B configuration. Variant B falls back to variant A content when only
 * the subject differs.
 */
export function renderVariant(campaign: Campaign, variant: "a" | "b"): RenderedEmail {
  const isB = variant === "b" && campaign.isAbTest;
  const subject = isB && campaign.abSubjectB ? campaign.abSubjectB : campaign.subject;
  const html = isB && campaign.abHtmlContentB ? campaign.abHtmlContentB : (campaign.htmlContent || "");
  const text = campaign.textContent || "";
  return { subject, html, text, variant: isB ? "b" : "a" };
}

/**
 * Inject tracking into the HTML:
 * - rewrite links to /api/track/click/:shortId?u=contactId&t=token
 * - append open pixel /api/track/open/:campaignId/:contactId
 * - append unsubscribe footer link
 */
export async function injectTracking(
  html: string,
  campaignId: number,
  contactId: number
): Promise<string> {
  const base = getBaseUrl();
  let result = html;
  const clickToken = signTrackingToken("click", campaignId, contactId);
  const openToken = signTrackingToken("open", campaignId, contactId);
  const unsubToken = signTrackingToken("unsubscribe", campaignId, contactId);

  // Rewrite href links to tracked redirects
  const hrefRegex = /href="(https?:\/\/[^"]+)"/g;
  const matches = Array.from(result.matchAll(hrefRegex));
  for (const m of matches) {
    const originalUrl = m[1];
    // Skip unsubscribe/tracking links
    if (originalUrl.includes("/api/track/")) continue;
    const link = await db.getOrCreateEmailLink(campaignId, originalUrl);
    if (link) {
      const trackedUrl = `${base}/api/track/click/${link.shortId}?u=${contactId}&t=${clickToken}`;
      result = result.replace(`href="${originalUrl}"`, `href="${trackedUrl}"`);
    }
  }

  // Open pixel + unsubscribe footer before </body> (or append at end)
  const pixel = `<img src="${base}/api/track/open/${campaignId}/${contactId}?t=${openToken}" width="1" height="1" alt="" style="display:none;"/>`;
  const unsub = `<p style="text-align:center;font-family:Arial,sans-serif;font-size:11px;color:#94a3b8;padding:16px;">Não deseja mais receber estes e-mails? <a href="${base}/api/track/unsubscribe/${campaignId}/${contactId}?t=${unsubToken}" style="color:#6366f1;">Cancelar inscrição</a></p>`;
  const suffix = `${unsub}${pixel}`;
  if (result.includes("</body>")) {
    result = result.replace("</body>", `${suffix}</body>`);
  } else {
    result += suffix;
  }
  return result;
}

export type SendResult = {
  totalRecipients: number;
  sent: number;
  failed: number;
  variantACount: number;
  variantBCount: number;
  sandbox: boolean;
  firstError?: string;
  /** number of recipients held back for the auto-winner rollout */
  heldForWinner: number;
};

async function dispatchToRecipients(
  campaign: Campaign,
  recipients: Array<{ id: number; email: string }>,
  pickVariant: (index: number) => "a" | "b",
): Promise<Omit<SendResult, "totalRecipients" | "heldForWinner">> {
  const smtpConfig = await db.getDefaultSmtpConfig(campaign.orgId);
  const fromName = campaign.fromName || "Colabix";
  const fromEmail = campaign.fromEmail || smtpConfig?.fromEmail || "noreply@mailflow.app";

  let sent = 0;
  let failed = 0;
  let variantACount = 0;
  let variantBCount = 0;
  let sandbox = false;
  let firstError: string | undefined;

  for (let i = 0; i < recipients.length; i++) {
    const r = recipients[i];
    const variant = pickVariant(i);
    if (variant === "a") variantACount++;
    else variantBCount++;

    const rendered = renderVariant(campaign, variant);
    const trackedHtml = await injectTracking(rendered.html, campaign.id, r.id);

    const result = await dispatchEmail(smtpConfig, {
      to: r.email,
      subject: rendered.subject,
      html: trackedHtml,
      text: rendered.text,
      fromName,
      fromEmail,
      replyTo: campaign.replyTo || undefined,
    });

    if (result.sandbox) sandbox = true;
    if (result.delivered) {
      sent++;
      await db.createCampaignSendFull(campaign.id, r.id, r.email, variant, "sent", result.messageId);
    } else {
      failed++;
      if (!firstError) firstError = result.error;
      await db.createCampaignSendFull(campaign.id, r.id, r.email, variant, "failed", undefined, result.error);
    }
  }

  return { sent, failed, variantACount, variantBCount, sandbox, firstError };
}

/**
 * Send a campaign with A/B variant splitting, tracking injection and
 * per-send records.
 *
 * When `abAutoWinner` is enabled, only `abTestPercent`% of the audience
 * receives the test (split 50/50 between variants); the remainder is held
 * back until `sendWinnerToRemainder` runs (via Heartbeat after `abWaitHours`).
 */
export async function sendCampaign(campaign: Campaign): Promise<SendResult> {
  const all = await db.getCampaignRecipients(campaign.orgId, campaign.targetListId ?? undefined);

  // Randomize who lands in the test pool and in each variant; taking the first
  // N rows (oldest contacts) would bias the A/B result.
  let testPool = campaign.isAbTest ? shuffle(all) : all;
  let heldForWinner = 0;
  if (campaign.isAbTest && campaign.abAutoWinner) {
    const pct = Math.min(Math.max(campaign.abTestPercent ?? 20, 5), 100);
    const testSize = Math.max(2, Math.ceil((all.length * pct) / 100));
    testPool = testPool.slice(0, testSize);
    heldForWinner = all.length - testPool.length;
  }

  const stats = await dispatchToRecipients(
    campaign,
    testPool,
    (i) => (campaign.isAbTest ? (i % 2 === 0 ? "a" : "b") : "a"),
  );

  return { ...stats, totalRecipients: all.length, heldForWinner };
}

export async function sendCampaignAndPersist(campaign: Campaign): Promise<SendResult> {
  try {
    const result = await sendCampaign(campaign);
    const failedAll = result.totalRecipients > 0 && result.sent === 0;
    await db.updateCampaign(campaign.orgId, campaign.id, {
      status: failedAll ? "failed" : "sent",
      sentAt: new Date(),
      totalRecipients: result.totalRecipients,
      totalSent: result.sent,
      totalDelivered: result.sent,
    });
    return result;
  } catch (error) {
    await db.updateCampaign(campaign.orgId, campaign.id, {
      status: "failed",
      sentAt: new Date(),
    });
    throw error;
  }
}

/**
 * Auto-winner rollout: determine the winning variant from current metrics
 * and send it to every subscribed recipient that has not received the
 * campaign yet. Idempotent — skips contacts that already have a send record.
 */
export async function sendWinnerToRemainder(campaign: Campaign): Promise<{
  winner: "a" | "b";
  sent: number;
  failed: number;
  remaining: number;
  sandbox: boolean;
  firstError?: string;
}> {
  const results = await db.getAbTestResults(campaign.id);
  const criteria = campaign.abWinnerCriteria || "open_rate";
  const rateOf = (v: { sent: number; uniqueOpens: number; uniqueClicks: number }) =>
    v.sent === 0 ? 0 : criteria === "open_rate" ? v.uniqueOpens / v.sent : v.uniqueClicks / v.sent;
  // Tie favors variant A (original)
  const winner: "a" | "b" = rateOf(results.b) > rateOf(results.a) ? "b" : "a";

  const all = await db.getCampaignRecipients(campaign.orgId, campaign.targetListId ?? undefined);
  const alreadySent = await db.getSentContactIds(campaign.id);
  const remainder = all.filter(r => !alreadySent.has(r.id));

  const stats = await dispatchToRecipients(campaign, remainder, () => winner);

  return {
    winner,
    sent: stats.sent,
    failed: stats.failed,
    remaining: remainder.length,
    sandbox: stats.sandbox,
    firstError: stats.firstError,
  };
}

/**
 * Send a single test email of a campaign to a given address.
 * Uses the same rendering pipeline (variant A or B) but does NOT inject
 * tracking, does not create send records and does not touch metrics —
 * the subject is prefixed with [TESTE] so it is unmistakable in the inbox.
 */
export async function sendTestEmail(
  campaign: Campaign,
  to: string,
  variant: "a" | "b" = "a",
): Promise<{ delivered: boolean; sandbox: boolean; error?: string }> {
  const smtpConfig = await db.getDefaultSmtpConfig(campaign.orgId);
  const rendered = renderVariant(campaign, variant);
  const fromName = campaign.fromName || "Colabix";
  const fromEmail = campaign.fromEmail || smtpConfig?.fromEmail || "noreply@mailflow.app";

  const banner = `<div style="background:#eef2ff;border:1px solid #c7d2fe;border-radius:8px;padding:10px 16px;margin-bottom:16px;font-family:Arial,sans-serif;font-size:12px;color:#4338ca;">E-mail de teste — este envio não gera métricas nem registros de campanha.</div>`;
  const html = rendered.html.includes("<body")
    ? rendered.html.replace(/(<body[^>]*>)/, `$1${banner}`)
    : banner + rendered.html;

  const result = await dispatchEmail(smtpConfig, {
    to,
    subject: `[TESTE] ${rendered.subject}`,
    html,
    text: rendered.text,
    fromName,
    fromEmail,
    replyTo: campaign.replyTo || undefined,
  });

  return { delivered: result.delivered, sandbox: result.sandbox, error: result.error };
}
