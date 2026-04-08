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
    browserInstance = null;
    const executablePath = findChromiumExecutable() || undefined;
    browserInstance = await puppeteer.launch({
      headless: true,
      executablePath,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--no-first-run",
        "--no-zygote",
        "--disable-extensions",
        "--disable-background-networking",
      ],
    });
    browserInstance.on("disconnected", () => {
      browserInstance = null;
    });
  }
  return browserInstance;
}

export async function htmlToPdf(
  html: string,
  width: number,
  height: number,
  dpi: number = 96
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    if (dpi > 96) {
      const deviceScaleFactor = Math.ceil(dpi / 96);
      await page.setViewport({
        width: Math.ceil(width * 96),
        height: Math.ceil(height * 96),
        deviceScaleFactor,
      });
    }
    await page.setContent(html, { waitUntil: "networkidle0", timeout: 120000 });
    const pdf = await page.pdf({
      width: width.toFixed(4) + "in",
      height: height.toFixed(4) + "in",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } catch (err) {
    // If the browser connection dropped during rendering, reset so the next
    // call gets a fresh instance rather than retrying on a dead connection.
    if (err instanceof Error && (err.constructor.name === "ConnectionClosedError" || err.message.includes("Connection closed"))) {
      browserInstance = null;
    }
    throw err;
  } finally {
    // page.close() can throw ConnectionClosedError if the browser already
    // crashed. Swallow it — the real error (if any) was already re-thrown
    // above, and a disconnected-event listener will reset browserInstance.
    try {
      await page.close();
    } catch {
      browserInstance = null;
    }
  }
}
