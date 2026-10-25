import type * as db from "../db";

type SmtpConfig = NonNullable<
  Awaited<ReturnType<typeof db.getDefaultSmtpConfig>>
>;

export type EmailMessage = {
  to: string;
  subject: string;
  html: string;
  text: string;
  fromName: string;
  fromEmail: string;
  replyTo?: string;
};

export type EmailDispatchResult = {
  delivered: boolean;
  messageId?: string;
  error?: string;
  sandbox: boolean;
};

export async function dispatchEmail(
  config: SmtpConfig | undefined,
  params: EmailMessage
): Promise<EmailDispatchResult> {
  if (!config || !config.apiKey) {
    return {
      delivered: true,
      messageId: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      sandbox: true,
    };
  }

  try {
    if (config.provider === "sendgrid") {
      const res = await fetch("https://api.sendgrid.com/v3/mail/send", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${config.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          personalizations: [{ to: [{ email: params.to }] }],
          from: { email: params.fromEmail, name: params.fromName },
          reply_to: params.replyTo ? { email: params.replyTo } : undefined,
          subject: params.subject,
          content: [
            { type: "text/plain", value: params.text || " " },
            { type: "text/html", value: params.html || " " },
          ],
        }),
      });
      if (res.status === 202) {
        return {
          delivered: true,
          messageId: res.headers.get("x-message-id") || undefined,
          sandbox: false,
        };
      }
      const body = await res.text();
      return {
        delivered: false,
        error: `SendGrid ${res.status}: ${body.slice(0, 300)}`,
        sandbox: false,
      };
    }

    if (config.provider === "mailgun") {
      const domain = config.smtpHost || "";
      const form = new URLSearchParams();
      form.set("from", `${params.fromName} <${params.fromEmail}>`);
      form.set("to", params.to);
      form.set("subject", params.subject);
      form.set("html", params.html);
      form.set("text", params.text);
      if (params.replyTo) form.set("h:Reply-To", params.replyTo);
      const res = await fetch(`https://api.mailgun.net/v3/${domain}/messages`, {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`api:${config.apiKey}`).toString("base64")}`,
        },
        body: form,
      });
      if (res.ok) {
        const data = (await res.json()) as { id?: string };
        return { delivered: true, messageId: data.id, sandbox: false };
      }
      const body = await res.text();
      return {
        delivered: false,
        error: `Mailgun ${res.status}: ${body.slice(0, 300)}`,
        sandbox: false,
      };
    }

    if (config.provider === "mailflow") {
      return {
        delivered: true,
        messageId: `sandbox-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        sandbox: true,
      };
    }

    return {
      delivered: false,
      error: `Provedor "${config.provider}" ainda não é suportado para envio. Use SendGrid ou Mailgun.`,
      sandbox: false,
    };
  } catch (error) {
    return {
      delivered: false,
      error: error instanceof Error ? error.message : "Unknown dispatch error",
      sandbox: false,
    };
  }
}
