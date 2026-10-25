import express from "express";
import * as db from "../db";
import { verifyTrackingToken } from "../security";

/**
 * Registers email tracking routes:
 * - GET /api/track/open/:campaignId/:contactId?t=token  → 1x1 transparent pixel
 * - GET /api/track/click/:shortId?u=contactId&t=token    → redirect to original URL
 * - GET /api/track/unsubscribe/:campaignId/:contactId?t=token  → unsubscribe page
 * - POST /api/track/unsubscribe/:campaignId/:contactId?t=token → confirm unsubscribe
 *
 * Every event requires an HMAC token bound to (purpose, campaignId, contactId)
 * that is only generated when the email is built (see emailSender.injectTracking).
 * Without it, anyone could enumerate the sequential IDs to unsubscribe contacts
 * of any organization or inflate open/click metrics.
 */

const INVALID_LINK_PAGE = `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Link inválido</title></head><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;color:#1e293b;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0"><div style="background:#fff;border-radius:16px;padding:40px;max-width:480px;width:90%;text-align:center"><h1 style="font-size:22px">Link inválido ou expirado</h1><p style="color:#64748b">Use o link de cancelamento que veio no próprio e-mail.</p></div></body></html>`;

const PIXEL_GIF_BASE64 =
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";

export function registerTrackingRoutes(app: express.Express) {
  // Open tracking pixel
  app.get("/api/track/open/:campaignId/:contactId", async (req, res) => {
    try {
      const campaignId = parseInt(req.params.campaignId, 10);
      const contactId = parseInt(req.params.contactId, 10);
      if (verifyTrackingToken("open", campaignId, contactId, req.query.t)) {
        await db.recordOpenEvent(
          campaignId,
          null,
          contactId,
          req.headers["user-agent"],
          req.ip
        );
      }
    } catch (e) {
      // Silent fail — tracking must never break the pixel
    }
    const imgBuffer = Buffer.from(PIXEL_GIF_BASE64, "base64");
    res.setHeader("Content-Type", "image/gif");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.send(imgBuffer);
  });

  // Click tracking redirect
  app.get("/api/track/click/:shortId", async (req, res) => {
    try {
      const shortId = req.params.shortId;
      const link = await db.getEmailLinkByShortId(shortId);
      if (link) {
        await db.incrementLinkClicks(link.id);
        // The campaign always comes from the stored link, never from the URL.
        const campaignId = link.campaignId;
        const contactId = parseInt(req.query.u as string, 10);
        if (verifyTrackingToken("click", campaignId, contactId, req.query.t)) {
          await db.recordClickEvent(
            campaignId,
            null,
            contactId,
            link.url,
            req.headers["user-agent"],
            req.ip
          );
        }
        return res.redirect(302, link.url);
      }
    } catch (e) {
      // Fall through to 404
    }
    res.status(404).send("Link not found");
  });

  // Unsubscribe page (GET)
  app.get("/api/track/unsubscribe/:campaignId/:contactId", async (req, res) => {
    const campaignId = parseInt(req.params.campaignId, 10);
    const contactId = parseInt(req.params.contactId, 10);
    const token = req.query.t;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    if (!verifyTrackingToken("unsubscribe", campaignId, contactId, token)) {
      return res.status(400).send(INVALID_LINK_PAGE);
    }
    res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Cancelar inscrição — MailFlow</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { background: #fff; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 90%; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04); text-align: center; }
          h1 { font-size: 24px; font-weight: 600; margin-bottom: 16px; }
          p { color: #64748b; line-height: 1.6; margin-bottom: 24px; }
          button { background: #6366f1; color: #fff; border: none; padding: 12px 32px; border-radius: 8px; font-size: 15px; font-weight: 500; cursor: pointer; transition: background 0.2s; }
          button:hover { background: #4f46e5; }
          .confirmed { color: #16a34a; font-weight: 600; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Cancelar inscrição</h1>
          <p>Tem certeza de que deseja cancelar a inscrição? Você não receberá mais e-mails desta lista.</p>
          <form method="POST" action="/api/track/unsubscribe/${campaignId}/${contactId}?t=${encodeURIComponent(String(token))}">
            <button type="submit">Sim, cancelar inscrição</button>
          </form>
        </div>
      </body>
      </html>
    `);
  });

  // Unsubscribe confirmation (POST)
  app.post(
    "/api/track/unsubscribe/:campaignId/:contactId",
    async (req, res) => {
      const campaignId = parseInt(req.params.campaignId, 10);
      const contactId = parseInt(req.params.contactId, 10);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      if (
        !verifyTrackingToken("unsubscribe", campaignId, contactId, req.query.t)
      ) {
        return res.status(400).send(INVALID_LINK_PAGE);
      }
      try {
        await db.recordUnsubscribeEvent(campaignId, null, contactId);
      } catch (e) {
        console.error("[Tracking] Failed to record unsubscribe", e);
        return res.status(500).send(INVALID_LINK_PAGE);
      }
      res.send(`
      <!DOCTYPE html>
      <html lang="pt-BR">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Inscrição cancelada — MailFlow</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f8fafc; color: #1e293b; display: flex; align-items: center; justify-content: center; min-height: 100vh; }
          .card { background: #fff; border-radius: 16px; padding: 48px 40px; max-width: 480px; width: 90%; box-shadow: 0 1px 3px rgba(0,0,0,0.08), 0 8px 24px rgba(0,0,0,0.04); text-align: center; }
          h1 { font-size: 24px; font-weight: 600; margin-bottom: 16px; }
          p { color: #64748b; line-height: 1.6; }
          .check { font-size: 48px; color: #16a34a; margin-bottom: 16px; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="check">✓</div>
          <h1>Inscrição cancelada</h1>
          <p>Você foi removido da lista com sucesso. Não enviaremos mais e-mails para você.</p>
        </div>
      </body>
      </html>
    `);
    }
  );
}
