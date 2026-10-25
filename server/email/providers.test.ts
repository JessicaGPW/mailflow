import { afterEach, describe, expect, it, vi } from "vitest";
import { dispatchEmail, type EmailMessage } from "./providers";

const message: EmailMessage = {
  to: "person@example.com",
  subject: "Hello",
  html: "<p>Hello</p>",
  text: "Hello",
  fromName: "MailFlow",
  fromEmail: "sender@example.com",
  replyTo: "reply@example.com",
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("email provider adapters", () => {
  it("sends SendGrid messages and returns the provider message ID", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(null, {
          status: 202,
          headers: { "x-message-id": "sendgrid-123" },
        })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchEmail(
      { provider: "sendgrid", apiKey: "test-key" } as never,
      message
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.sendgrid.com/v3/mail/send",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: "Bearer test-key",
          "Content-Type": "application/json",
        },
      })
    );
    expect(
      JSON.parse(fetchMock.mock.calls[0]![1]!.body as string)
    ).toMatchObject({
      personalizations: [{ to: [{ email: message.to }] }],
      subject: message.subject,
      reply_to: { email: message.replyTo },
    });
    expect(result).toEqual({
      delivered: true,
      messageId: "sendgrid-123",
      sandbox: false,
    });
  });

  it("reports SendGrid rejection without marking the message delivered", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(new Response("invalid sender", { status: 400 }))
    );

    const result = await dispatchEmail(
      { provider: "sendgrid", apiKey: "test-key" } as never,
      message
    );

    expect(result).toMatchObject({ delivered: false, sandbox: false });
    expect(result.error).toContain("SendGrid 400");
  });

  it("sends Mailgun form data with its API-key authorization", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "mailgun-123" }), { status: 200 })
      );
    vi.stubGlobal("fetch", fetchMock);

    const result = await dispatchEmail(
      {
        provider: "mailgun",
        apiKey: "test-key",
        smtpHost: "mg.example.com",
      } as never,
      message
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "https://api.mailgun.net/v3/mg.example.com/messages",
      expect.objectContaining({
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from("api:test-key").toString("base64")}`,
        },
      })
    );
    const requestBody = fetchMock.mock.calls[0]![1]!.body as URLSearchParams;
    expect(requestBody.get("to")).toBe(message.to);
    expect(requestBody.get("h:Reply-To")).toBe(message.replyTo);
    expect(result).toEqual({
      delivered: true,
      messageId: "mailgun-123",
      sandbox: false,
    });
  });

  it("turns network errors into an explicit failed delivery", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("network unavailable"))
    );

    const result = await dispatchEmail(
      { provider: "sendgrid", apiKey: "test-key" } as never,
      message
    );

    expect(result).toEqual({
      delivered: false,
      error: "network unavailable",
      sandbox: false,
    });
  });
});
