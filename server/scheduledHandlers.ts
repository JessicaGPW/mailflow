import * as db from "./db";
import { sendCampaignAndPersist, sendWinnerToRemainder } from "./emailSender";

export async function runLocalSchedulerTick(now = new Date()): Promise<void> {
  const dueCampaigns = await db.getDueScheduledCampaigns(now);
  for (const campaign of dueCampaigns) {
    const claimed = await db.claimCampaignForSending(campaign.orgId, campaign.id, ["scheduled"]);
    if (!claimed) continue;
    try {
      const result = await sendCampaignAndPersist(campaign);
      console.info(
        `[Scheduler] Campaign ${campaign.id} processed: ${result.sent} sent, ${result.failed} failed.`,
      );
    } catch (error) {
      console.error(`[Scheduler] Scheduled campaign ${campaign.id} failed.`, error);
    }
  }

  const dueWinnerCampaigns = await db.getDueAbWinnerCampaigns(now);
  for (const campaign of dueWinnerCampaigns) {
    const claimed = await db.claimAbWinnerProcessing(campaign.orgId, campaign.id, now);
    if (!claimed) continue;
    try {
      const result = await sendWinnerToRemainder(campaign);
      await db.updateCampaign(campaign.orgId, campaign.id, {
        abWinnerVariant: result.winner,
        abWinnerSentAt: now,
        abWinnerProcessingAt: null,
        totalSent: (campaign.totalSent ?? 0) + result.sent,
        totalDelivered: (campaign.totalDelivered ?? 0) + result.sent,
      });
      console.info(
        `[Scheduler] A/B winner for campaign ${campaign.id}: ${result.winner}; ${result.sent} sent, ${result.failed} failed.`,
      );
    } catch (error) {
      await db.releaseAbWinnerProcessing(campaign.orgId, campaign.id);
      console.error(`[Scheduler] A/B winner rollout for campaign ${campaign.id} failed.`, error);
    }
  }
}

export function startLocalScheduler(intervalMs = 15_000): () => void {
  if (!process.env.DATABASE_URL) {
    console.info("[Scheduler] Disabled because DATABASE_URL is not configured.");
    return () => {};
  }

  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await runLocalSchedulerTick();
    } catch (error) {
      console.error("[Scheduler] Could not process scheduled work.", error);
    } finally {
      running = false;
    }
  };

  void tick();
  const timer = setInterval(() => void tick(), intervalMs);
  timer.unref();
  return () => clearInterval(timer);
}
