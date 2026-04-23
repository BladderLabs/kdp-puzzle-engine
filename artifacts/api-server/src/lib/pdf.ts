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
        // Quality flags — favour print fidelity over screen rendering speed
        "--font-render-hinting=none",
        "--disable-font-subpixel-positioning",
        "--force-color-profile=srgb",
      ],
    });
    browserInstance.on("disconnected", () => {
      browserInstance = null;
    });
  }
  return browserInstance;
}

/**
 * Render HTML to a print-quality PDF.
 *
 * Defaults to 300 DPI (KDP commercial print spec). Three quality gates:
 *   1. deviceScaleFactor scales the viewport for sharp raster content
 *   2. Explicit document.fonts.ready wait — prevents silent font fallback
 *      (the classic cause of "why does my KDP proof look wrong?")
 *   3. Explicit image-load wait — prevents half-loaded rasterization
 */
export async function htmlToPdf(
  html: string,
  width: number,
  height: number,
  dpi: number = 300,
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    // High-DPI viewport — deviceScaleFactor clamped to 1..4. At dpi=300, dsf=3.
    const deviceScaleFactor = Math.max(1, Math.min(4, Math.round(dpi / 96)));
    await page.setViewport({
      width: Math.ceil(width * 96),
      height: Math.ceil(height * 96),
      deviceScaleFactor,
    });

    await page.setContent(html, { waitUntil: "networkidle0", timeout: 180000 });

    // Explicit font readiness — Chromium's networkidle0 fires when the font
    // STYLESHEET finishes loading, not when the font FILES have finished
    // loading AND rendering. document.fonts.ready covers the latter.
    await page.evaluate(async () => {
      if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
        await document.fonts.ready;
      }
    });

    // Explicit image-load settle — the cover image and any theme-art <img>
    // tags must be fully decoded before rasterizing, or the PDF gets blank
    // boxes. Timeout per image at 15s to avoid hanging on a single broken src.
    await page.evaluate(async () => {
      const images = Array.from(document.images);
      await Promise.all(
        images.map(img =>
          img.complete && img.naturalWidth > 0
            ? Promise.resolve()
            : new Promise<void>(resolve => {
                const done = () => resolve();
                img.addEventListener("load", done, { once: true });
                img.addEventListener("error", done, { once: true });
                setTimeout(done, 15000);
              }),
        ),
      );
    });

    const pdf = await page.pdf({
      width: width.toFixed(4) + "in",
      height: height.toFixed(4) + "in",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
      scale: 1, // never let Chromium shrink-to-fit — KDP rejects slightly-off dimensions
    });
    return Buffer.from(pdf);
  } catch (err) {
    // Browser may have crashed mid-render; reset so next call gets a fresh one.
    if (
      err instanceof Error &&
      (err.constructor.name === "ConnectionClosedError" || err.message.includes("Connection closed"))
    ) {
      browserInstance = null;
    }
    throw err;
  } finally {
    // page.close() can throw ConnectionClosedError if the browser crashed.
    try {
      await page.close();
    } catch {
      browserInstance = null;
    }
  }
}
