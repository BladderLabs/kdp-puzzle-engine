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

// Two-phase page function for cheerio-scraper:
//   Phase 1 (search results page): collect title, ASIN, price, reviews, stars + enqueue product pages
//   Phase 2 (product detail pages): extract BSR from #detailBullets or salesRank elements
// Results are merged server-side by ASIN.
const AMAZON_PAGE_FUNCTION = `
async function pageFunction(context) {
  const { $, request, enqueueRequest } = context;
  const BASE = 'https://www.amazon.com';

  // ── Phase 2: product detail page — extract BSR ────────────────────────────
  if (request.userData && request.userData.type === 'product') {
    const asin = request.userData.asin;
    let bsr = null;

    // Location 1: detail bullets wrapper (newer Amazon layout)
    $('[id^="detailBullets"] .a-list-item, #productDetails_detailBullets_sections1 tr').each(function() {
      const text = $(this).text();
      if (text.includes('Best Sellers Rank')) {
        const m = text.match(/#([\\d,]+)/);
        if (m && !bsr) bsr = parseInt(m[1].replace(/,/g, ''));
      }
    });

    // Location 2: legacy #SalesRank (older Amazon layout)
    if (!bsr) {
      const salesText = $('#SalesRank').text();
      const m2 = salesText.match(/#([\\d,]+)/);
      if (m2) bsr = parseInt(m2[1].replace(/,/g, ''));
    }

    // Location 3: product details table (another Amazon variant)
    if (!bsr) {
      $('table#productDetails_techSpec_section_1 tr, .a-keyvalue.prodDetTable tr').each(function() {
        const label = $(this).find('th').text();
        if (label.includes('Best Sellers Rank')) {
          const val = $(this).find('td').text();
          const m3 = val.match(/#([\\d,]+)/);
          if (m3) bsr = parseInt(m3[1].replace(/,/g, ''));
        }
      });
    }

    return [{ _type: 'bsr', asin, bsr }];
  }

  // ── Phase 1: search results page ──────────────────────────────────────────
  const items = [];
  let enqueued = 0;

  $('[data-component-type="s-search-result"]').each(function() {
    const el = $(this);
    const asin = (el.attr('data-asin') || '').trim();
    if (!asin) return;

    const title = (
      el.find('h2 .a-text-normal').first().text() ||
      el.find('h2 span').first().text()
    ).trim();
    if (!title || title.length < 5) return;

    const priceText = el.find('.a-price .a-offscreen').first().text().replace(/[$,]/g, '').trim();
    const price = priceText ? parseFloat(priceText) : null;

    const starsLabel = el.find('[aria-label*="out of 5"]').first().attr('aria-label') || '';
    const starsMatch = starsLabel.match(/([\\d.]+)\\s+out\\s+of\\s+5/i);
    const stars = starsMatch ? parseFloat(starsMatch[1]) : null;

    const reviewLabel = el.find('[aria-label$="ratings"], [aria-label$="reviews"]').first().attr('aria-label') || '';
    const reviewMatch = reviewLabel.match(/([\\d,]+)/);
    const reviews = reviewMatch ? parseInt(reviewMatch[1].replace(/,/g, '')) : 0;

    // Build product URL from ASIN (most reliable — avoids href parsing issues)
    const productUrl = 'https://www.amazon.com/dp/' + asin;

    // Also try to get a canonical URL from the link for display purposes
    const href = el.find('h2 a').attr('href') || '';
    const displayUrl = href ? (href.startsWith('http') ? href.split('?')[0] : BASE + href.split('?')[0]) : productUrl;

    // Enqueue product page for BSR extraction (first 8 results only to stay within limits)
    if (enqueued < 8) {
      enqueueRequest({ url: productUrl, userData: { type: 'product', asin } });
      enqueued++;
    }

    items.push({ _type: 'search', title, asin, price: price, reviews, stars, url: displayUrl });
  });

  return items;
}
`;

function toNum(val: unknown): number | null {
  if (typeof val === "number") return isFinite(val) ? val : null;
  if (typeof val === "string") {
    const n = parseFloat(val.replace(/[$,\s]/g, ""));
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * Merge search-phase items with BSR-phase items by ASIN and return
 * normalised ApifyProduct records.
 */
function mergeAndNormalise(rawItems: Record<string, unknown>[]): ApifyProduct[] {
  // Separate search items from BSR items
  const searchItems = rawItems.filter(it => it._type === "search" || !it._type);
  const bsrMap = new Map<string, number | null>();

  for (const it of rawItems) {
    if (it._type === "bsr" && typeof it.asin === "string" && it.asin) {
      bsrMap.set(it.asin, toNum(it.bsr));
    }
  }

  const products: ApifyProduct[] = [];
  for (const item of searchItems) {
    const title = ((item.title as string) ?? "").trim();
    if (!title || title.length < 5) continue;

    const asin = ((item.asin ?? "") as string) || undefined;
    const price = toNum(item.price ?? item.currentPrice) ?? null;
    const reviews = toNum(item.reviews ?? item.reviewsCount) ?? 0;
    const stars = toNum(item.stars ?? item.rating) ?? null;
    // Prefer BSR from product page; fall back to what search page may have provided
    const bsr = (asin && bsrMap.has(asin)) ? bsrMap.get(asin)! : (toNum(item.bsr) ?? null);
    const url = ((item.url ?? "") as string) || undefined;

    const demand_score = computeDemandScore(bsr, reviews, stars);
    const competition_level = computeCompetitionLevel(reviews, bsr);

    try {
      const product = ApifyProductSchema.parse({
        title, asin, bsr, reviews, price, stars, demand_score, competition_level, url,
      });
      products.push(product);
    } catch {
      // skip malformed item
    }

    if (products.length >= 10) break;
  }

  products.sort((a, b) => b.demand_score - a.demand_score);
  return products;
}

async function callApify(keyword: string, apiKey: string): Promise<ApifyProduct[]> {
  const searchUrl = buildAmazonSearchUrl(keyword);

  const input = {
    startUrls: [{ url: searchUrl }],
    pageFunction: AMAZON_PAGE_FUNCTION,
    // Allow: 1 search page + up to 8 product pages for BSR extraction
    maxCrawledPagesPerCrawl: 10,
    maxRequestsPerCrawl: 12,
    proxyConfiguration: { useApifyProxy: true },
  };

  // Run sync and collect all dataset items (search items + BSR items mixed)
  const runUrl = `${APIFY_BASE_URL}/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${apiKey}&timeout=180&maxItems=100`;

  const response = await fetch(runUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(190_000),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Apify API error: ${response.status} ${response.statusText}${errBody ? ` — ${errBody.slice(0, 300)}` : ""}`);
  }

  const rawItems = await response.json() as Record<string, unknown>[];
  return mergeAndNormalise(rawItems);
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
