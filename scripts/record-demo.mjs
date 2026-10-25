import { config } from "dotenv";
import { chromium } from "playwright";
import { copyFile, mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

config({ path: process.env.ENV_FILE ?? ".env.demo", override: false });

const email = process.env.DEMO_ADMIN_EMAIL ?? "demo@mailflow.local";
const password = process.env.DEMO_ADMIN_PASSWORD;
const baseUrl = process.env.DEMO_BASE_URL ?? "http://localhost:3000";
const outputPath = resolve("docs/demo.webm");

if (!password) {
  throw new Error("DEMO_ADMIN_PASSWORD is required in the selected environment file.");
}

const recordingDir = await mkdtemp(join(tmpdir(), "mailflow-demo-"));
const browser = await chromium.launch({ channel: "msedge", headless: true });
let context;
let page;
let completed = false;
const pageErrors = [];
const wait = (milliseconds = 1800) => page.waitForTimeout(milliseconds);

try {
  context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    recordVideo: {
      dir: recordingDir,
      size: { width: 1280, height: 720 },
    },
  });
  page = await context.newPage();
  page.on("pageerror", error => pageErrors.push(error.message));

  await page.goto(baseUrl, { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.getByRole("heading", { name: "Entrar no MailFlow" }).waitFor();
  await wait();

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await page.waitForURL(url => url.pathname.startsWith("/app"), { timeout: 15_000 });
  await page.getByRole("heading", { name: "Dashboard" }).waitFor();
  await wait(2400);

  await page.getByRole("button", { name: "Contatos", exact: true }).click();
  await page.getByRole("heading", { name: "Contatos" }).waitFor();
  await wait(2200);

  await page.getByRole("button", { name: "Campanhas", exact: true }).click();
  await page.getByRole("heading", { name: "Campanhas" }).waitFor();
  await wait(2200);

  await page.getByRole("link", { name: "Nova campanha" }).click();
  await page.getByRole("heading", { name: "Nova campanha" }).waitFor();
  await page.getByRole("button", { name: "Galeria de templates" }).click();
  await page.getByRole("dialog").waitFor();
  await wait(2500);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Relatórios", exact: true }).click();
  await page.getByRole("heading", { name: "Relatórios" }).waitFor();
  await wait(2200);

  if (pageErrors.length > 0) {
    throw new Error(`Browser reported page errors: ${pageErrors.join("; ")}`);
  }
  completed = true;
} finally {
  const video = page?.video();
  try {
    if (context) await context.close();
    if (video && completed) {
      await mkdir(dirname(outputPath), { recursive: true });
      await copyFile(await video.path(), outputPath);
    }
  } finally {
    try {
      await browser.close();
    } finally {
      await rm(recordingDir, { recursive: true, force: true });
    }
  }
}

console.info(`Demo video saved to ${outputPath}`);
