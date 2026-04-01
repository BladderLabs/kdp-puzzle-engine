// ============================================================
// PUPPETEER PDF GENERATION — ported faithfully from KDP Engine v5
// Security hardening: all network requests are intercepted and
// aborted during rendering to prevent SSRF from any source.
// ============================================================

import puppeteer, { Browser } from "puppeteer";

let browserInstance: Browser | null = null;

export async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-web-security",
        "--disable-features=IsolateOrigins,site-per-process",
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
    // Block ALL outbound network requests during rendering.
    // This prevents SSRF regardless of the HTML content —
    // only data: and about: URIs are allowed (inline content only).
    await page.setRequestInterception(true);
    page.on("request", (req) => {
      const proto = new URL(req.url()).protocol;
      if (proto === "data:" || proto === "about:") {
        req.continue();
      } else {
        req.abort("blockedbyclient");
      }
    });

    await page.setContent(html, { waitUntil: "domcontentloaded", timeout: 90000 });
    const pdf = await page.pdf({
      width: width + "in",
      height: height + "in",
      printBackground: true,
      preferCSSPageSize: true,
      margin: { top: 0, right: 0, bottom: 0, left: 0 },
    });
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}
