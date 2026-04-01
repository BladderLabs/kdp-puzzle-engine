import puppeteer, { Browser } from "puppeteer";

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (!browserInstance || !browserInstance.connected) {
    browserInstance = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
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
    // Block all outbound network requests during rendering.
    // HTML is always server-generated, but this provides defense-in-depth.
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
