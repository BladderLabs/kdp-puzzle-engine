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
const APIFY_ACTOR_ID = "junglee~free-amazon-product-search";
const APIFY_BASE_URL = "https://api.apify.com/v2";

function normaliseApifyItem(item: Record<string, unknown>): ApifyProduct | null {
  const title = (item.title ?? item.name ?? "") as string;
  if (!title || title.length < 3) return null;

  const rawPrice = item.price ?? item.currentPrice ?? item.minPrice;
  let price: number | null = null;
  if (typeof rawPrice === "number") price = rawPrice;
  else if (typeof rawPrice === "string") {
    const m = rawPrice.replace(/[$,]/g, "");
    price = parseFloat(m) || null;
  }

  const reviews = typeof item.reviewsCount === "number"
    ? item.reviewsCount
    : typeof item.numberOfReviews === "number"
      ? item.numberOfReviews
      : typeof item.ratingsCount === "number"
        ? item.ratingsCount
        : 0;

  const stars = typeof item.stars === "number"
    ? item.stars
    : typeof item.rating === "number"
      ? item.rating
      : null;

  const rawBsr = item.salesRank ?? item.bestSellerRank ?? item.bsr;
  let bsr: number | null = null;
  if (typeof rawBsr === "number") bsr = rawBsr;
  else if (typeof rawBsr === "string") bsr = parseInt(rawBsr) || null;

  const asin = (item.asin ?? item.productId ?? "") as string;
  const url = (item.url ?? item.productUrl ?? "") as string;

  const demand_score = computeDemandScore(bsr, reviews, stars);
  const competition_level = computeCompetitionLevel(reviews, bsr);

  return ApifyProductSchema.parse({
    title,
    asin: asin || undefined,
    bsr,
    reviews,
    price,
    stars,
    demand_score,
    competition_level,
    url: url || undefined,
  });
}

async function callApify(keyword: string, apiKey: string): Promise<ApifyProduct[]> {
  const input = {
    keyword,
    maxItems: 12,
    country: "US",
    categoryOrProductPageUrls: [],
  };

  const url = `${APIFY_BASE_URL}/acts/${APIFY_ACTOR_ID}/run-sync-get-dataset-items?token=${apiKey}&timeout=60&maxItems=12`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(70_000),
  });

  if (!response.ok) {
    throw new Error(`Apify API error: ${response.status} ${response.statusText}`);
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
router.post("/api/apify/market-research", async (req, res) => {
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
