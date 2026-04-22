/**
 * Gift-SKU + Year-Branding pipeline helpers.
 *
 * Two pure utility modules that can be composed into any book build:
 *   • Year-Branding: inject/normalise year tokens in titles ("2026 Word Search"),
 *     with Q4 rollover to next year.
 *   • Gift-SKU: keyword augmentation, ribbon cover accent, gift-tag insert page,
 *     and recipient-framed hook sentence.
 *
 * Pure, synchronous, no I/O. Call from the book build pipeline or the
 * Listing Intelligence agent's post-processor.
 */

// ────────────────────────────────────────────────────────────────────────────
// Year Branding
// ────────────────────────────────────────────────────────────────────────────

export interface YearBrandingOptions {
  /** Override "now" for testing or deterministic rendering. */
  currentDate?: Date;
  /** prefix/suffix/auto — auto picks prefix for short titles, suffix for long. */
  placement?: "prefix" | "suffix" | "auto";
  /** Force a specific year (bypasses Q4 rollover inference). */
  forceYear?: number;
}

/**
 * If it's October or later, publish-year rolls to next year — puzzle books
 * for 2027 must hit Amazon by Oct/Nov 2026 to catch the Q1 search wave.
 */
export function inferPublishYear(date: Date = new Date()): number {
  const month = date.getMonth(); // 0-indexed
  return month >= 9 ? date.getFullYear() + 1 : date.getFullYear();
}

export function hasYearInTitle(title: string): boolean {
  return /\b(20\d{2})\b/.test(title);
}

/**
 * Prepend or append the current publish year to a title — unless the title
 * already contains a year token (20XX). Auto-placement prefixes short titles
 * and suffixes long ones so total length stays under 80 chars when possible.
 */
export function applyYearBranding(
  title: string,
  opts: YearBrandingOptions = {},
): string {
  if (!title || hasYearInTitle(title)) return title;
  const year = opts.forceYear ?? inferPublishYear(opts.currentDate);
  const placement = opts.placement ?? "auto";
  if (placement === "prefix") return `${year} ${title}`;
  if (placement === "suffix") return `${title} — ${year} Edition`;
  return title.length < 50 ? `${year} ${title}` : `${title} — ${year} Edition`;
}

// ────────────────────────────────────────────────────────────────────────────
// Gift-SKU
// ────────────────────────────────────────────────────────────────────────────

export interface GiftSkuOptions {
  /** Who the book is being gifted to — "Mom", "Dad", "a Teacher", "Grandma". */
  recipientLabel?: string;
  /** When true, applies gift framing to the title itself. */
  brandTitle?: boolean;
}

const GENERIC_GIFT_KEYWORDS = [
  "puzzle gift book",
  "gift puzzle book adults",
  "thoughtful gift puzzle book",
  "perfect gift puzzle book",
  "gift for puzzle lovers",
];

/**
 * Merge gift-specific keyword boosters into an existing 7-slot list.
 * Gift phrases slot in at positions 2-4 (top two most specific keywords
 * remain primary). Dedupe case-insensitively. Cap at 7.
 */
export function augmentKeywordsForGift(
  keywords: string[],
  recipientLabel?: string,
): string[] {
  const lc = (s: string) => s.toLowerCase().trim();
  const seen = new Set(keywords.map(lc));
  const giftBoost: string[] = [];
  if (recipientLabel) {
    const rlc = `gift for ${recipientLabel.toLowerCase()}`;
    if (!seen.has(rlc)) {
      giftBoost.push(rlc);
      seen.add(rlc);
    }
  }
  for (const g of GENERIC_GIFT_KEYWORDS) {
    if (!seen.has(lc(g)) && giftBoost.length < 3) {
      giftBoost.push(g);
      seen.add(lc(g));
    }
  }
  const head = keywords.slice(0, 2);
  const tail = keywords.slice(2);
  const merged = [...head, ...giftBoost, ...tail];
  const final: string[] = [];
  const dedupe = new Set<string>();
  for (const k of merged) {
    const key = lc(k);
    if (!dedupe.has(key) && final.length < 7) {
      dedupe.add(key);
      final.push(k);
    }
  }
  return final;
}

/**
 * Recipient-framed hook sentence. Takes the bare hook and prepends a gift context.
 */
export function buildGiftFramedHook(baseHook: string, recipientLabel?: string): string {
  const who = (recipientLabel || "someone special").trim();
  const bare = (baseHook || "").trim().replace(/^[A-Z]/, c => c.toLowerCase());
  if (!bare) return `A thoughtful gift for ${who}.`;
  return `A thoughtful gift for ${who} — ${bare}`;
}

/**
 * Gift brand applied to a title. Keeps the core title intact, wraps with gift framing.
 * "Grandma's Crossword Book" → "A Gift for Grandma: Grandma's Crossword Book"
 */
export function applyGiftTitleFraming(title: string, recipientLabel?: string): string {
  if (!title) return title;
  if (/gift/i.test(title)) return title; // already gift-framed
  const who = (recipientLabel || "Someone Special").trim();
  return `A Gift for ${who}: ${title}`;
}

/**
 * SVG ribbon/corner accent for the front cover on gift-SKU books.
 * Renders a folded ribbon at top-left with "GIFT" in the flag.
 */
export function buildRibbonAccentSvg(accent: string): string {
  const ac = accent || "#b8860b";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 110 130" width="1in" height="1.18in" style="position:absolute;top:0;left:0;z-index:7;pointer-events:none;filter:drop-shadow(1px 2px 3px rgba(0,0,0,0.25));">
    <path d="M 0,0 L 70,0 L 100,30 L 100,70 L 70,100 L 0,100 Z" fill="${ac}"/>
    <path d="M 8,8 L 64,8 L 90,32 L 90,66 L 64,92 L 8,92 Z" fill="none" stroke="#fff" stroke-width="1.2" stroke-opacity="0.65"/>
    <text x="48" y="56" text-anchor="middle" font-family="'Playfair Display',Georgia,serif" font-size="15" font-weight="800" fill="#fff" letter-spacing="2">GIFT</text>
    <path d="M 8,100 L 0,125 L 20,110 Z" fill="${ac}" opacity="0.88"/>
    <path d="M 20,110 L 38,125 L 38,100 Z" fill="${ac}" opacity="0.75"/>
  </svg>`;
  return svg.replace(/\n\s*/g, " ").trim();
}

/**
 * A dedicated interior page for gift-SKU books, placed after the title page.
 * Provides a fillable "To / From / Message" gift tag. Uses handwritten Caveat
 * font for personal feel.
 */
export function buildGiftTagInsertHtml(recipientLabel: string = "You"): string {
  return `<div class="pg" style="display:flex;flex-direction:column;align-items:center;justify-content:center;padding:1.2in 1in;min-height:9in;">
    <div style="font-family:'Caveat',cursive;font-size:46px;color:#8b3a3a;margin-bottom:30px;text-align:center;">A Gift for ${recipientLabel}</div>
    <div style="width:75%;max-width:4.4in;border:2px dashed #b8860b;padding:0.55in 0.5in;border-radius:8px;background:rgba(255,250,240,0.5);">
      <div style="display:grid;grid-template-columns:auto 1fr;gap:14px 20px;font-family:'Lora',serif;font-size:15px;line-height:1.4;">
        <div style="color:#8b6b3a;font-weight:600;">To:</div>
        <div style="border-bottom:1px solid #b8860b;height:1.6em;"></div>
        <div style="color:#8b6b3a;font-weight:600;">From:</div>
        <div style="border-bottom:1px solid #b8860b;height:1.6em;"></div>
        <div style="color:#8b6b3a;font-weight:600;grid-column:1;align-self:start;">Message:</div>
        <div style="grid-column:2;">
          <div style="border-bottom:1px solid #b8860b;height:1.6em;margin-bottom:10px;"></div>
          <div style="border-bottom:1px solid #b8860b;height:1.6em;margin-bottom:10px;"></div>
          <div style="border-bottom:1px solid #b8860b;height:1.6em;"></div>
        </div>
      </div>
    </div>
    <div style="margin-top:48px;font-family:'Caveat',cursive;font-size:24px;color:#999;letter-spacing:2px;">~ with love ~</div>
  </div>`;
}

// ────────────────────────────────────────────────────────────────────────────
// Combined pipeline — apply both year-branding and gift-SKU to a spec
// ────────────────────────────────────────────────────────────────────────────

export interface BrandingSpec {
  title: string;
  subtitle?: string;
  keywords?: string[];
  hookSentence?: string;
}

export interface BrandingResult extends BrandingSpec {
  interiorInserts: string[]; // HTML pages to splice into the interior PDF
  coverAccents: string[];     // SVG snippets to add to the cover front panel
  yearApplied?: number;       // year that was branded (if any)
  giftApplied: boolean;       // true if gift framing was applied
}

/**
 * Apply year-branding (if missing) and gift-SKU framing (if enabled) to an
 * editorial spec. Returns the transformed spec plus any extra rendered
 * artefacts (interior pages, cover accents) that downstream renderers should
 * splice into the book.
 */
export function applyBranding(
  spec: BrandingSpec,
  options: {
    yearBranding?: YearBrandingOptions | false;
    giftSku?: GiftSkuOptions | false;
    coverAccent?: string;
  } = {},
): BrandingResult {
  const interiorInserts: string[] = [];
  const coverAccents: string[] = [];
  let yearApplied: number | undefined;
  let giftApplied = false;

  let title = spec.title;
  let subtitle = spec.subtitle;
  let keywords = spec.keywords ?? [];
  let hookSentence = spec.hookSentence;

  // Year branding
  if (options.yearBranding !== false) {
    const before = title;
    title = applyYearBranding(title, options.yearBranding || {});
    if (title !== before) {
      const m = /\b(20\d{2})\b/.exec(title);
      if (m) yearApplied = Number(m[1]);
    }
  }

  // Gift-SKU
  if (options.giftSku && options.giftSku !== false) {
    giftApplied = true;
    const recipient = options.giftSku.recipientLabel;

    if (options.giftSku.brandTitle) {
      title = applyGiftTitleFraming(title, recipient);
    }
    keywords = augmentKeywordsForGift(keywords, recipient);
    if (hookSentence) hookSentence = buildGiftFramedHook(hookSentence, recipient);

    interiorInserts.push(buildGiftTagInsertHtml(recipient || "You"));
    const ac = options.coverAccent || "#b8860b";
    coverAccents.push(buildRibbonAccentSvg(ac));
  }

  return {
    title,
    subtitle,
    keywords,
    hookSentence,
    interiorInserts,
    coverAccents,
    yearApplied,
    giftApplied,
  };
}
