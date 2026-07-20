import type { Request, Response } from "express";
import { sdk } from "./_core/sdk";
import * as db from "./db";
import { sendWinnerToRemainder } from "./emailSender";
import { notifyOwner } from "./_core/notification";

/**
 * Heartbeat callback: A/B auto-winner rollout.
 *
 * Triggered once, `abWaitHours` after the test batch was sent. Determines
 * the winning variant from live metrics and sends it to the remainder of
 * the audience. Idempotent: skips if the winner was already sent.
 */
export async function abWinnerHandler(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) {
      return res.status(403).json({ error: "cron-only" });
    }

    const campaign = await db.getCampaignByCronTaskUid(user.taskUid);
    if (!campaign) {
      // Orphan cron — return 2xx so the platform stops retrying
      return res.json({ ok: true, skipped: "orphan" });
    }

    if (campaign.abWinnerSentAt) {
      return res.json({ ok: true, skipped: "already-sent", winner: campaign.abWinnerVariant });
    }
    if (!campaign.isAbTest || !campaign.abAutoWinner) {
      return res.json({ ok: true, skipped: "not-ab-auto-winner" });
    }

    const result = await sendWinnerToRemainder(campaign);

    await db.updateCampaign(campaign.orgId, campaign.id, {
      abWinnerVariant: result.winner,
      abWinnerSentAt: new Date(),
      totalSent: (campaign.totalSent ?? 0) + result.sent,
      totalDelivered: (campaign.totalDelivered ?? 0) + result.sent,
    });

    if (result.failed > 0) {
      void notifyOwner({
        title: "MailFlow: falhas no envio da variante vencedora",
        content: `Campanha "${campaign.name}" (org ${campaign.orgId}): ${result.failed} de ${result.remaining} envios da vencedora falharam.${result.firstError ? ` Primeiro erro: ${result.firstError}` : ""}`,
      }).catch(() => {});
    }

    return res.json({
      ok: true,
      winner: result.winner,
      sent: result.sent,
      failed: result.failed,
      remaining: result.remaining,
      sandbox: result.sandbox,
    });
  } catch (e) {
    const err = e instanceof Error ? e : new Error("Unknown error");
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      context: { url: req.originalUrl },
      timestamp: new Date().toISOString(),
    });
  }
}
