import { Router, type IRouter } from "express";
import { z } from "zod";

const router: IRouter = Router();

export const ApifyProductSchema = z.object({
  title: z.string(),
  asin: z.string().optional(),
  bsr: z.number().nullable(),
  reviews: z.number(),
  price: z.number().nullable(),
  stars: z.number().nullable(),
  demand_score: z.number().min(0).max(10),
  competition_level: z.enum(["Low", "Medium", "High"]),
  url: z.string().optional(),
});

export type ApifyProduct = z.infer<typeof ApifyProductSchema>;

export interface MarketResearchResult {
  keyword: string;
  puzzleType?: string;
  results: ApifyProduct[];
  fetchedAt: number;
  source: "apify" | "fallback";
}

const RequestBodySchema = z.object({
  keyword: z.string().min(1).max(200),
  puzzleType: z.string().optional(),
});

// ─── In-memory cache (15-min TTL) ─────────────────────────────────────────────
const cache = new Map<string, MarketResearchResult>();
const CACHE_TTL_MS = 15 * 60 * 1000;

function getCacheKey(keyword: string, puzzleType?: string): string {
  return `${keyword.toLowerCase().trim()}|${puzzleType ?? ""}`;
}

function getCached(keyword: string, puzzleType?: string): MarketResearchResult | null {
  const key = getCacheKey(keyword, puzzleType);
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.fetchedAt > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry;
}

function setCache(result: MarketResearchResult): void {
  const key = getCacheKey(result.keyword, result.puzzleType);
  cache.set(key, result);
  // Evict entries older than 1 hour to prevent unbounded growth
  for (const [k, v] of cache) {
    if (Date.now() - v.fetchedAt > 60 * 60 * 1000) cache.delete(k);
  }
}

// ─── Demand score computation ──────────────────────────────────────────────────
function computeDemandScore(bsr: number | null, reviews: number, stars: number | null): number {
  let score = 5;
  if (bsr !== null) {
    if (bsr < 1000) score += 3;
    else if (bsr < 5000) score += 2;
    else if (bsr < 20000) score += 1;
    else if (bsr > 100000) score -= 1;
  }
  if (reviews < 50) score += 1;
  else if (reviews > 500) score -= 1;
  if (stars !== null && stars >= 4.5) score += 1;
  return Math.min(10, Math.max(1, score));
}

function computeCompetitionLevel(reviews: number, bsr: number | null): "Low" | "Medium" | "High" {
  if (reviews < 100 && (bsr === null || bsr > 20000)) return "Low";
  if (reviews > 400 || (bsr !== null && bsr < 5000)) return "High";
  return "Medium";
}

// ─── Apify API call ────────────────────────────────────────────────────────────
// apify/cheerio-scraper — Apify's free Cheerio scraper; provides $ (jQuery-like) for static HTML parsing
const APIFY_ACTOR_ID = "apify~cheerio-scraper";
const APIFY_BASE_URL = "https://api.apify.com/v2";

function buildAmazonSearchUrl(keyword: string): string {
  // Search Amazon Books, sorted by review count (high competition indicators at top)
  return `https://www.amazon.com/s?k=${encodeURIComponent(keyword)}&i=stripbooks&s=review-rank`;
}

// Page function for the cheerio-scraper actor — uses Cheerio's $ API (jQuery-like, static HTML)
// Note: Amazon renders review counts via JS; we extract title/ASIN/price from static HTML
const AMAZON_PAGE_FUNCTION = `
async function pageFunction(context) {
  const { $, request } = context;
  const items = [];
  const baseUrl = 'https://www.amazon.com';

  $('[data-component-type="s-search-result"]').each(function() {
    const el = $(this);
    const asin = el.attr('data-asin') || '';

    // Title — try multiple selectors Amazon uses
    const title = (
      el.find('h2 .a-text-normal').first().text() ||
      el.find('h2 span').first().text() ||
      el.find('[data-cy="title-recipe"] span').first().text()
    ).trim();
    if (!title || title.length < 5) return;

    // Price — .a-offscreen has the full "$X.XX" string in static HTML
    const priceText = el.find('.a-price .a-offscreen').first().text().replace(/[$,]/g, '').trim();
    const price = priceText ? parseFloat(priceText) : null;

    // Stars from aria-label on the rating icon (static HTML)
    const starsLabel = el.find('[aria-label*="out of 5"]').first().attr('aria-label') || '';
    const starsMatch = starsLabel.match(/([\\d.]+)\\s+out\\s+of\\s+5/i);
    const stars = starsMatch ? parseFloat(starsMatch[1]) : null;

    // Review count — try aria-label pattern "X ratings" on the count link
    const reviewLabel = el.find('[aria-label$="ratings"], [aria-label$="reviews"]').first().attr('aria-label') || '';
    const reviewMatch = reviewLabel.match(/([\\d,]+)/);
    const reviews = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : 0;

    // Product URL
    const href = el.find('h2 a').attr('href') || '';
    const url = href ? (href.startsWith('http') ? href.split('?')[0] : baseUrl + href.split('?')[0]) : undefined;

    items.push({ title, asin: asin || undefined, price, reviews, stars, bsr: null, url });
  });

  return items;
}
`;

function extractNumberFromString(val: unknown): number | null {
  if (typeof val === "number") return isFinite(val) ? val : null;
  if (typeof val === "string") {
    const cleaned = val.replace(/[$,\s]/g, "");
    const n = parseFloat(cleaned);
    return isNaN(n) ? null : n;
  }
  return null;
}

function normaliseApifyItem(item: Record<string, unknown>): ApifyProduct | null {
  const title = ((item.title as string) ?? "").trim();
  if (!title || title.length < 5) return null;

  const price = extractNumberFromString(item.price ?? item.currentPrice) ?? null;
  const reviews = extractNumberFromString(item.reviews ?? item.reviewsCount ?? item.numberOfReviews) as number ?? 0;
  const stars = extractNumberFromString(item.stars ?? item.rating) ?? null;
  const bsr = extractNumberFromString(item.bsr ?? item.salesRank) ?? null;
  const asin = ((item.asin ?? "") as string) || undefined;
  const url = ((item.url ?? "") as string) || undefined;

  const demand_score = computeDemandScore(bsr, reviews, stars);
  const competition_level = computeCompetitionLevel(reviews, bsr);

  try {
    return ApifyProductSchema.parse({ title, asin, bsr, reviews, price, stars, demand_score, competition_level, url });
  } catch {
    return null;
  }
}

async function callApify(keyword: string, apiKey: string): Promise<ApifyProduct[]> {
  const searchUrl = buildAmazonSearchUrl(keyword);

  const input = {
    startUrls: [{ url: searchUrl }],
    pageFunction: AMAZON_PAGE_FUNCTION,
    maxPagesPerCrawl: 1,
    maxCrawledPagesPerCrawl: 1,
    maxRequestsPerCrawl: 3,
    proxyConfiguration: { useApifyProxy: true },
  };

  const runUrl = `${APIFY_BASE_URL}/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${apiKey}&timeout=120&maxItems=15`;

  const response = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(130_000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Apify API error: ${response.status} ${response.statusText}${errBody ? ` — ${errBody.slice(0, 300)}` : ""}`);
  }

  const items = await response.json() as Record<string, unknown>[];
  const products: ApifyProduct[] = [];
  for (const item of items) {
    const normalised = normaliseApifyItem(item);
    if (normalised) products.push(normalised);
    if (products.length >= 10) break;
  }

  products.sort((a, b) => b.demand_score - a.demand_score);
  return products;
}

// ─── Route handler ─────────────────────────────────────────────────────────────
router.post("/apify/market-research", async (req, res) => {
  const parsed = RequestBodySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request", details: parsed.error.flatten() });
    return;
  }

  const { keyword, puzzleType } = parsed.data;
  const apiKey = process.env.APIFY_API_KEY;

  if (!apiKey) {
    res.json({
      keyword,
      puzzleType,
      results: [],
      fetchedAt: Date.now(),
      source: "fallback",
      note: "APIFY_API_KEY not configured — set it to enable live market data",
    });
    return;
  }

  const cached = getCached(keyword, puzzleType);
  if (cached) {
    res.json({ ...cached, cached: true });
    return;
  }

  try {
    const searchQuery = puzzleType
      ? `${keyword} ${puzzleType} book`
      : `${keyword} puzzle book`;

    const results = await callApify(searchQuery, apiKey);
    const result: MarketResearchResult = {
      keyword,
      puzzleType,
      results,
      fetchedAt: Date.now(),
      source: "apify",
    };
    setCache(result);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(502).json({
      keyword,
      puzzleType,
      results: [],
      fetchedAt: Date.now(),
      source: "fallback",
      error: message,
    });
  }
});

export default router;
