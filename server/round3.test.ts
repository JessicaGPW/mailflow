import { describe, expect, it } from "vitest";
import { checkSpf, checkDmarc, checkDkim } from "./dnsVerifier";
import { renderVariant } from "./emailSender";
import { galleryTemplates } from "../client/src/components/EmailTemplateGallery";
import type { Campaign } from "../drizzle/schema";

function makeCampaign(overrides: Partial<Campaign> = {}): Campaign {
  return {
    id: 1,
    orgId: 1,
    name: "Test",
    subject: "Assunto A",
    preheader: null,
    fromName: "Test",
    fromEmail: "t@example.com",
    replyTo: null,
    htmlContent: "<p>Conteúdo A</p>",
    textContent: "Conteúdo A",
    designJson: null,
    targetListId: null,
    targetSegmentId: null,
    status: "draft",
    scheduledAt: null,
    sentAt: null,
    totalRecipients: 0,
    totalSent: 0,
    totalDelivered: 0,
    totalOpens: 0,
    totalUniqueOpens: 0,
    totalClicks: 0,
    totalUniqueClicks: 0,
    totalBounces: 0,
    totalUnsubscribes: 0,
    totalComplaints: 0,
    isAbTest: false,
    abSubjectB: null,
    abHtmlContentB: null,
    abWinnerCriteria: "open_rate",
    abAutoWinner: false,
    abTestPercent: 20,
    abWaitHours: 4,
    abWinnerVariant: null,
    abWinnerSentAt: null,
    scheduleCronTaskUid: null,
    createdBy: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Campaign;
}

// Live DNS lookups are flaky in CI and offline sandboxes: opt in with RUN_NETWORK_TESTS=1.
describe.skipIf(!process.env.RUN_NETWORK_TESTS)("DNS verification (live resolution)", () => {
  it("verifies SPF on a domain known to publish SPF (google.com) when include matches", async () => {
    // google.com publishes v=spf1 include:_spf.google.com ~all
    const result = await checkSpf("google.com", "include:_spf.google.com");
    expect(result.status).toBe("verified");
    expect(result.found.some(r => r.startsWith("v=spf1"))).toBe(true);
  }, 15000);

  it("fails SPF when the required include is missing from the record", async () => {
    const result = await checkSpf("google.com", "include:mailflow.com");
    expect(result.status).toBe("failed");
    expect(result.message).toContain("include:mailflow.com");
  }, 15000);

  it("fails SPF on a domain that does not exist", async () => {
    const result = await checkSpf("this-domain-does-not-exist-mailflow-12345.com");
    expect(result.status).toBe("failed");
  }, 15000);

  it("verifies DMARC on a domain known to publish DMARC (google.com)", async () => {
    const result = await checkDmarc("google.com");
    expect(result.status).toBe("verified");
  }, 15000);

  it("fails DKIM with an unknown selector", async () => {
    const result = await checkDkim("google.com", "nonexistent-selector-xyz");
    expect(result.status).toBe("failed");
  }, 15000);
});

describe("A/B variant rendering", () => {
  it("renders variant A content by default", () => {
    const campaign = makeCampaign({ isAbTest: true, abSubjectB: "Assunto B" });
    const rendered = renderVariant(campaign, "a");
    expect(rendered.subject).toBe("Assunto A");
    expect(rendered.variant).toBe("a");
  });

  it("renders variant B subject when A/B test is active", () => {
    const campaign = makeCampaign({ isAbTest: true, abSubjectB: "Assunto B" });
    const rendered = renderVariant(campaign, "b");
    expect(rendered.subject).toBe("Assunto B");
    expect(rendered.variant).toBe("b");
  });

  it("variant B falls back to content A when no B content is set", () => {
    const campaign = makeCampaign({ isAbTest: true, abSubjectB: "Assunto B", abHtmlContentB: null });
    const rendered = renderVariant(campaign, "b");
    expect(rendered.html).toBe("<p>Conteúdo A</p>");
  });

  it("ignores variant B when campaign is not an A/B test", () => {
    const campaign = makeCampaign({ isAbTest: false, abSubjectB: "Assunto B" });
    const rendered = renderVariant(campaign, "b");
    expect(rendered.subject).toBe("Assunto A");
    expect(rendered.variant).toBe("a");
  });
});

describe("Template gallery", () => {
  it("provides the four expected templates", () => {
    const keys = galleryTemplates.map(t => t.key);
    expect(keys).toEqual(["newsletter", "promo", "welcome", "announcement"]);
  });

  it("every template builds valid blocks with unique ids", () => {
    for (const t of galleryTemplates) {
      const blocks = t.build();
      expect(blocks.length).toBeGreaterThan(3);
      const ids = blocks.map(b => b.id);
      expect(new Set(ids).size).toBe(ids.length);
      for (const b of blocks) {
        expect(["heading", "text", "image", "button", "divider", "spacer"]).toContain(b.type);
      }
    }
  });

  it("two builds of the same template produce independent block ids", () => {
    const a = galleryTemplates[0].build();
    const b = galleryTemplates[0].build();
    expect(a[0].id).not.toBe(b[0].id);
  });
});

describe("A/B auto-winner test pool sizing", () => {
  // Mirrors the sizing logic in sendCampaign
  const testSize = (total: number, pct: number) => Math.max(2, Math.ceil((total * Math.min(Math.max(pct, 5), 100)) / 100));

  it("holds back 80% of the audience with a 20% test", () => {
    expect(testSize(1000, 20)).toBe(200);
  });

  it("enforces a minimum test pool of 2 recipients", () => {
    expect(testSize(3, 5)).toBe(2);
  });

  it("clamps percent to at least 5%", () => {
    expect(testSize(1000, 1)).toBe(50);
  });
});
