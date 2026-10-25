export type NotificationPayload = {
  title: string;
  content: string;
};

export async function notifyOwner(payload: NotificationPayload): Promise<boolean> {
  const title = payload.title.trim();
  const content = payload.content.trim();
  if (!title || !content) {
    throw new Error("Notification title and content are required.");
  }
  console.info(`[MailFlow notification] ${title}\n${content}`);
  return true;
}
