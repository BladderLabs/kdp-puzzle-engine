import puppeteer, { Browser } from "puppeteer";
import { execSync } from "child_process";

let browserInstance: Browser | null = null;

function findChromiumExecutable(): string {
  try {
    const path = execSync("which chromium 2>/dev/null || which chromium-browser 2>/dev/null", {
      encoding: "utf-8",
    }).trim();
    if (path) return path;
  } catch {}
  return "";
}

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    const executablePath = findChromiumExecutable() || undefined;
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--single-process",
      ],
    });
  }
  return browserInstance;
}

export async function htmlToPdf(
  html: string,
  width: number,
  height: number
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // Allow all external requests (needed for Google Fonts to load)
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 120000 });
    const pdf = await page.pdf({
      width: width.toFixed(4) + "in",
      height: height.toFixed(4) + "in",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
