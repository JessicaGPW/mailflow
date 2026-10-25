import { config as loadEnv } from "dotenv";
import * as db from "./db";
import { hashPassword } from "./_core/localAuth";

loadEnv({ path: process.env.ENV_FILE ?? ".env", override: true });

const demoContacts = [
  { email: "ana.silva@example.test", firstName: "Ana", lastName: "Silva", source: "manual" as const },
  { email: "bruno.costa@example.test", firstName: "Bruno", lastName: "Costa", source: "manual" as const },
  { email: "carla.mendes@example.test", firstName: "Carla", lastName: "Mendes", source: "manual" as const },
  { email: "diego.lima@example.test", firstName: "Diego", lastName: "Lima", source: "manual" as const },
  { email: "elisa.rocha@example.test", firstName: "Elisa", lastName: "Rocha", source: "manual" as const },
];

async function seed() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required to seed demo data.");
  const email = (process.env.DEMO_ADMIN_EMAIL ?? "demo@mailflow.local").trim().toLowerCase();
  const password = process.env.DEMO_ADMIN_PASSWORD ?? "DemoMailflow123!";
  const existing = await db.getUserByEmail(email);
  if (existing) {
    console.info(`Demo account ${email} already exists; seed skipped.`);
    return;
  }

  const user = await db.createLocalUserAccount({
    name: "Demo MailFlow",
    email,
    passwordHash: await hashPassword(password),
  });
  const membership = await db.getOrgsByUserId(user.id);
  const org = membership[0]?.org;
  if (!org) throw new Error("Demo account was created without its default organization.");

  const list = await db.createList(org.id, "Contatos de demonstração", "Dados fictícios para explorar o MailFlow.");
  if (!list) throw new Error("Failed to create the demo contact list.");

  const contacts = [];
  for (const contactData of demoContacts) {
    const contact = await db.createContact(org.id, contactData);
    if (!contact) throw new Error(`Failed to create demo contact ${contactData.email}.`);
    await db.addContactToList(contact.id, list.id);
    contacts.push(contact);
  }

  const sentAt = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await db.createCampaign(org.id, {
    name: "Novidades da semana (demo)",
    subject: "As novidades que chegaram esta semana",
    preheader: "Uma seleção de atualizações para você.",
    htmlContent: "<h1>Novidades da semana</h1><p>Este e-mail e todos os contatos desta demonstração são fictícios.</p>",
    textContent: "Novidades da semana. Este e-mail e todos os contatos desta demonstração são fictícios.",
    targetListId: list.id,
    status: "sent",
    sentAt,
    totalRecipients: contacts.length,
    totalSent: contacts.length,
    totalDelivered: contacts.length,
    totalOpens: 3,
    totalUniqueOpens: 3,
    totalClicks: 1,
    totalUniqueClicks: 1,
  });
  await db.createCampaign(org.id, {
    name: "Boas-vindas (rascunho)",
    subject: "Boas-vindas à nossa comunidade",
    preheader: "Conheça o que você pode fazer por aqui.",
    htmlContent: "<h1>Boas-vindas!</h1><p>Este é um rascunho de demonstração.</p>",
    textContent: "Boas-vindas! Este é um rascunho de demonstração.",
    targetListId: list.id,
    status: "draft",
  });

  console.info(`Demo data created. Login: ${email} / ${password}`);
}

seed()
  .catch((error: unknown) => {
    console.error("[Demo seed] Failed to create fictitious data.", error);
    process.exitCode = 1;
  })
  .finally(() => db.closeDb());
