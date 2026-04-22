/**
 * Experience Mode cover layers.
 *
 * Each Experience Mode (sketch / detective / adventure / darkacademia / cozycottage /
 * mindful / standard) produces a set of SVG decorative overlays that slot into
 * buildCoverHTML. Gemini is never asked to render text on the cover — text is
 * always composited in HTML/CSS, and these SVG layers provide the genre-specific
 * visual fingerprint that makes each book recognisable on an Amazon shelf.
 */

export type ExperienceMode =
  | "standard"
  | "sketch"
  | "detective"
  | "adventure"
  | "darkacademia"
  | "cozycottage"
  | "mindful";

export interface ExperienceLayers {
  /** Full-bleed background texture. Sits above the base colour, below art. */
  texture: string;
  /** Decorative border frame on the front panel. */
  border: string;
  /** Four corner ornaments or flourishes. */
  corners: string;
  /** Spine-side vertical decoration (drawn on the spine area of the full wrap). */
  spineOrnament: string;
  /** Back-cover top banner decoration (above the back-cover blurb). */
  backBanner: string;
  /** A CSS filter to apply to the hero art (sketch desaturates, mindful softens, etc.). */
  heroFilter: string;
  /** A short machine-readable descriptor for the listing + QA log. */
  fingerprint: string;
}

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

/** One-line SVG helper: flattens whitespace so the SVG can sit inside inline HTML. */
function oneline(svg: string): string {
  return svg.replace(/\n\s*/g, " ").trim();
}

/** A reusable empty layer so downstream consumers never need null-checks. */
const EMPTY: ExperienceLayers = {
  texture: "",
  border: "",
  corners: "",
  spineOrnament: "",
  backBanner: "",
  heroFilter: "",
  fingerprint: "standard-plain",
};

// ────────────────────────────────────────────────────────────────────────────
// Sketch Journey — hand-drawn pencil-and-sketchbook aesthetic
// ────────────────────────────────────────────────────────────────────────────

function sketchLayers(ac: string): ExperienceLayers {
  const texture = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0;width:100%;height:100%;opacity:0.18;pointer-events:none;z-index:1;"
         viewBox="0 0 400 600">
      <defs>
        <pattern id="hatch-s" patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(35)">
          <line x1="0" y1="0" x2="0" y2="6" stroke="${ac}" stroke-width="0.4" stroke-opacity="0.55"/>
        </pattern>
        <pattern id="hatch-s2" patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(-30)">
          <line x1="0" y1="0" x2="0" y2="9" stroke="${ac}" stroke-width="0.35" stroke-opacity="0.35"/>
        </pattern>
      </defs>
      <rect width="400" height="600" fill="url(#hatch-s)"/>
      <rect width="400" height="600" fill="url(#hatch-s2)"/>
    </svg>`);

  const border = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.18in;pointer-events:none;z-index:2;"
         viewBox="0 0 400 600">
      <rect x="3" y="3" width="394" height="594" fill="none"
            stroke="${ac}" stroke-width="1.3" stroke-opacity="0.72"
            stroke-dasharray="3 2 6 2 2 4"
            style="filter:url(#wobble)"/>
      <defs>
        <filter id="wobble">
          <feTurbulence type="fractalNoise" baseFrequency="0.04" numOctaves="2" seed="9"/>
          <feDisplacementMap in="SourceGraphic" scale="1.2"/>
        </filter>
      </defs>
    </svg>`);

  const corners = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.35in;pointer-events:none;z-index:3;"
         viewBox="0 0 400 600">
      <g fill="none" stroke="${ac}" stroke-opacity="0.6" stroke-width="1.1" stroke-linecap="round">
        <path d="M 6,22 Q 10,8 24,6" />
        <path d="M 376,6 Q 390,10 394,22" />
        <path d="M 6,578 Q 10,592 24,594" />
        <path d="M 376,594 Q 390,592 394,578" />
      </g>
    </svg>`);

  const spineOrnament = oneline(`
    <div style="position:absolute;top:20%;bottom:20%;left:50%;transform:translateX(-50%);width:0.06in;
                background:repeating-linear-gradient(to bottom, ${ac} 0 6px, transparent 6px 10px);
                opacity:0.6;"></div>`);

  const backBanner = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" width="100%" height="18"
         style="display:block;margin-bottom:10px;" viewBox="0 0 400 18">
      <path d="M 4,14 Q 30,3 56,12 T 104,13 T 156,11 T 208,14 T 260,12 T 312,13 T 360,11 T 396,14"
            fill="none" stroke="${ac}" stroke-width="1.2" stroke-opacity="0.8" stroke-linecap="round"/>
    </svg>`);

  return {
    texture,
    border,
    corners,
    spineOrnament,
    backBanner,
    heroFilter: "grayscale(0.35) contrast(1.05) sepia(0.08)",
    fingerprint: "sketch-pencil-hatch",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Detective Casebook — evidence-folder aesthetic
// ────────────────────────────────────────────────────────────────────────────

function detectiveLayers(ac: string): ExperienceLayers {
  const texture = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0;width:100%;height:100%;opacity:0.14;pointer-events:none;z-index:1;"
         viewBox="0 0 400 600">
      <defs>
        <pattern id="grid-d" patternUnits="userSpaceOnUse" width="18" height="18">
          <path d="M 18 0 L 0 0 0 18" fill="none" stroke="${ac}" stroke-width="0.3"/>
        </pattern>
      </defs>
      <rect width="400" height="600" fill="url(#grid-d)"/>
    </svg>`);

  // Classified stamp + redaction bars
  const border = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.15in;pointer-events:none;z-index:2;"
         viewBox="0 0 400 600">
      <rect x="2" y="2" width="396" height="596" fill="none" stroke="${ac}" stroke-width="2.4"/>
      <rect x="8" y="8" width="384" height="584" fill="none" stroke="${ac}" stroke-width="0.6" stroke-opacity="0.6"/>
    </svg>`);

  const corners = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.30in;pointer-events:none;z-index:3;"
         viewBox="0 0 400 600">
      <g fill="${ac}" fill-opacity="0.82">
        <rect x="2" y="2" width="34" height="6"/>
        <rect x="2" y="2" width="6" height="34"/>
        <rect x="362" y="2" width="34" height="6"/>
        <rect x="392" y="2" width="6" height="34"/>
        <rect x="2" y="592" width="34" height="6"/>
        <rect x="2" y="564" width="6" height="34"/>
        <rect x="362" y="592" width="34" height="6"/>
        <rect x="392" y="564" width="6" height="34"/>
      </g>
      <g transform="translate(300,28) rotate(-8)">
        <rect x="0" y="0" width="92" height="24" fill="none" stroke="${ac}" stroke-width="1.2"/>
        <text x="46" y="16" text-anchor="middle" font-family="'Special Elite','Courier New',monospace"
              font-size="10" font-weight="700" fill="${ac}" letter-spacing="2">CASE FILE</text>
      </g>
    </svg>`);

  const spineOrnament = oneline(`
    <div style="position:absolute;top:0.5in;left:0;right:0;height:0.04in;background:${ac};opacity:0.8;"></div>
    <div style="position:absolute;bottom:0.5in;left:0;right:0;height:0.04in;background:${ac};opacity:0.8;"></div>`);

  const backBanner = oneline(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;font-family:'Special Elite','Courier New',monospace;
                font-size:9px;letter-spacing:3px;color:${ac};text-transform:uppercase;">
      <span style="flex:1;height:1px;background:${ac};opacity:0.5;"></span>
      <span>EVIDENCE — DO NOT REMOVE</span>
      <span style="flex:1;height:1px;background:${ac};opacity:0.5;"></span>
    </div>`);

  return {
    texture,
    border,
    corners,
    spineOrnament,
    backBanner,
    heroFilter: "contrast(1.1) saturate(0.9)",
    fingerprint: "detective-casefile",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Adventure Quest — treasure-map aesthetic
// ────────────────────────────────────────────────────────────────────────────

function adventureLayers(ac: string): ExperienceLayers {
  const texture = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0;width:100%;height:100%;opacity:0.12;pointer-events:none;z-index:1;"
         viewBox="0 0 400 600">
      <defs>
        <filter id="paper-a">
          <feTurbulence type="fractalNoise" baseFrequency="0.8" numOctaves="2" seed="5"/>
          <feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.3  0 0 0 0 0.1  0 0 0 1 0"/>
        </filter>
      </defs>
      <rect width="400" height="600" filter="url(#paper-a)"/>
    </svg>`);

  const border = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.15in;pointer-events:none;z-index:2;"
         viewBox="0 0 400 600">
      <path d="M 6,6 L 394,6 L 394,594 L 6,594 Z" fill="none"
            stroke="${ac}" stroke-width="1.8" stroke-opacity="0.78"
            stroke-dasharray="14 4 2 4" stroke-linecap="round"/>
    </svg>`);

  const corners = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.32in;pointer-events:none;z-index:3;"
         viewBox="0 0 400 600">
      <g transform="translate(340,24)" fill="none" stroke="${ac}" stroke-opacity="0.8" stroke-width="1.4">
        <circle cx="24" cy="24" r="22"/>
        <circle cx="24" cy="24" r="16" stroke-opacity="0.45"/>
        <path d="M 24,4 L 30,24 L 24,44 L 18,24 Z" fill="${ac}" fill-opacity="0.72" stroke="none"/>
        <text x="24" y="10" text-anchor="middle" font-family="Georgia,serif" font-size="7"
              fill="${ac}" fill-opacity="0.9">N</text>
      </g>
      <g stroke="${ac}" stroke-opacity="0.55" stroke-width="1" fill="none">
        <path d="M 20,560 Q 60,540 110,556 T 210,550 T 310,560"
              stroke-dasharray="3 4"/>
        <circle cx="20"  cy="560" r="3" fill="${ac}"/>
        <path d="M 305,553 l -4,-6 l 8,0 z" fill="${ac}"/>
      </g>
    </svg>`);

  const spineOrnament = oneline(`
    <div style="position:absolute;top:30%;left:50%;transform:translateX(-50%);width:0.28in;height:0.28in;
                border:2px solid ${ac};border-radius:50%;opacity:0.8;"></div>
    <div style="position:absolute;top:31%;left:50%;transform:translateX(-50%);width:0.08in;height:0.08in;
                background:${ac};border-radius:50%;margin-top:0.1in;opacity:0.8;"></div>`);

  const backBanner = oneline(`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;font-family:'Georgia',serif;
                font-size:10px;letter-spacing:4px;color:${ac};text-transform:uppercase;font-style:italic;">
      <span>✦</span><span>— THE QUEST BEGINS —</span><span>✦</span>
    </div>`);

  return {
    texture,
    border,
    corners,
    spineOrnament,
    backBanner,
    heroFilter: "sepia(0.15) contrast(1.08) saturate(1.1)",
    fingerprint: "adventure-treasuremap",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Dark Academia — gothic scholar aesthetic
// ────────────────────────────────────────────────────────────────────────────

function darkAcademiaLayers(ac: string): ExperienceLayers {
  const texture = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0;width:100%;height:100%;opacity:0.10;pointer-events:none;z-index:1;"
         viewBox="0 0 400 600">
      <defs>
        <filter id="noise-da">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="1" seed="12"/>
          <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0"/>
        </filter>
      </defs>
      <rect width="400" height="600" filter="url(#noise-da)"/>
    </svg>`);

  const border = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.18in;pointer-events:none;z-index:2;"
         viewBox="0 0 400 600">
      <rect x="4" y="4" width="392" height="592" fill="none" stroke="${ac}" stroke-width="1.4"/>
      <rect x="10" y="10" width="380" height="580" fill="none" stroke="${ac}" stroke-width="0.5" stroke-opacity="0.6"/>
      <rect x="16" y="16" width="368" height="568" fill="none" stroke="${ac}" stroke-width="0.3" stroke-opacity="0.4"/>
    </svg>`);

  const corners = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.32in;pointer-events:none;z-index:3;"
         viewBox="0 0 400 600">
      <g fill="${ac}" fill-opacity="0.85">
        <path d="M 4,4 L 28,4 L 28,8 L 8,8 L 8,28 L 4,28 Z"/>
        <path d="M 396,4 L 372,4 L 372,8 L 392,8 L 392,28 L 396,28 Z"/>
        <path d="M 4,596 L 28,596 L 28,592 L 8,592 L 8,572 L 4,572 Z"/>
        <path d="M 396,596 L 372,596 L 372,592 L 392,592 L 392,572 L 396,572 Z"/>
      </g>
      <g transform="translate(200,34)" fill="none" stroke="${ac}" stroke-opacity="0.75" stroke-width="0.9">
        <path d="M -18,0 L 18,0 M 0,-6 L 0,6"/>
        <circle cx="0" cy="0" r="10" stroke-opacity="0.4"/>
      </g>
    </svg>`);

  const spineOrnament = oneline(`
    <div style="position:absolute;top:18%;left:50%;transform:translateX(-50%);width:0.12in;height:0.12in;
                border:1px solid ${ac};opacity:0.75;transform:translateX(-50%) rotate(45deg);"></div>
    <div style="position:absolute;bottom:18%;left:50%;transform:translateX(-50%);width:0.12in;height:0.12in;
                border:1px solid ${ac};opacity:0.75;transform:translateX(-50%) rotate(45deg);"></div>`);

  const backBanner = oneline(`
    <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;font-family:'Playfair Display',Georgia,serif;
                font-size:10px;letter-spacing:5px;color:${ac};text-transform:uppercase;font-style:italic;">
      <span style="flex:1;height:1px;background:${ac};opacity:0.5;"></span>
      <span>ex libris</span>
      <span style="flex:1;height:1px;background:${ac};opacity:0.5;"></span>
    </div>`);

  return {
    texture,
    border,
    corners,
    spineOrnament,
    backBanner,
    heroFilter: "contrast(1.15) brightness(0.92) saturate(0.85)",
    fingerprint: "darkacademia-scholar",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Cozy Cottage — warm hearth & tea aesthetic
// ────────────────────────────────────────────────────────────────────────────

function cozyCottageLayers(ac: string): ExperienceLayers {
  const texture = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0;width:100%;height:100%;opacity:0.09;pointer-events:none;z-index:1;"
         viewBox="0 0 400 600">
      <defs>
        <pattern id="dots-c" patternUnits="userSpaceOnUse" width="18" height="18">
          <circle cx="9" cy="9" r="0.9" fill="${ac}"/>
        </pattern>
      </defs>
      <rect width="400" height="600" fill="url(#dots-c)"/>
    </svg>`);

  const border = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.2in;pointer-events:none;z-index:2;"
         viewBox="0 0 400 600">
      <path d="M 6,6 L 394,6 L 394,594 L 6,594 Z" fill="none"
            stroke="${ac}" stroke-width="1.1" stroke-opacity="0.65" stroke-linejoin="round"
            stroke-dasharray="1 3"/>
    </svg>`);

  // Flower corners
  const corners = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.3in;pointer-events:none;z-index:3;"
         viewBox="0 0 400 600">
      <g fill="${ac}" fill-opacity="0.6">
        <g transform="translate(16,16)">
          <circle cx="0" cy="0" r="3"/>
          <circle cx="7" cy="-2" r="2.2"/>
          <circle cx="-2" cy="7" r="2.2"/>
          <circle cx="6" cy="6" r="1.6"/>
        </g>
        <g transform="translate(384,16)">
          <circle cx="0" cy="0" r="3"/>
          <circle cx="-7" cy="-2" r="2.2"/>
          <circle cx="2" cy="7" r="2.2"/>
          <circle cx="-6" cy="6" r="1.6"/>
        </g>
        <g transform="translate(16,584)">
          <circle cx="0" cy="0" r="3"/>
          <circle cx="7" cy="2" r="2.2"/>
          <circle cx="-2" cy="-7" r="2.2"/>
          <circle cx="6" cy="-6" r="1.6"/>
        </g>
        <g transform="translate(384,584)">
          <circle cx="0" cy="0" r="3"/>
          <circle cx="-7" cy="2" r="2.2"/>
          <circle cx="2" cy="-7" r="2.2"/>
          <circle cx="-6" cy="-6" r="1.6"/>
        </g>
      </g>
    </svg>`);

  const spineOrnament = oneline(`
    <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:0.14in;height:0.14in;
                background:${ac};border-radius:50%;opacity:0.7;box-shadow:0 0 0 3px rgba(255,255,255,0.2);"></div>`);

  const backBanner = oneline(`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;font-family:'Caveat','Playfair Display',serif;
                font-size:14px;color:${ac};font-style:italic;">
      <span>~ a cosy gift for a quiet afternoon ~</span>
    </div>`);

  return {
    texture,
    border,
    corners,
    spineOrnament,
    backBanner,
    heroFilter: "saturate(0.92) brightness(1.03)",
    fingerprint: "cozy-cottage-floral",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Mindful Wellness — serene, minimalist aesthetic
// ────────────────────────────────────────────────────────────────────────────

function mindfulLayers(ac: string): ExperienceLayers {
  const texture = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0;width:100%;height:100%;opacity:0.08;pointer-events:none;z-index:1;"
         viewBox="0 0 400 600">
      <g stroke="${ac}" stroke-width="0.3" fill="none" stroke-opacity="0.6">
        <path d="M 0,120 Q 100,100 200,120 T 400,120"/>
        <path d="M 0,240 Q 100,220 200,240 T 400,240"/>
        <path d="M 0,360 Q 100,340 200,360 T 400,360"/>
        <path d="M 0,480 Q 100,460 200,480 T 400,480"/>
      </g>
    </svg>`);

  const border = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.3in;pointer-events:none;z-index:2;"
         viewBox="0 0 400 600">
      <line x1="40" y1="14" x2="360" y2="14" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.6"/>
      <line x1="40" y1="586" x2="360" y2="586" stroke="${ac}" stroke-width="0.7" stroke-opacity="0.6"/>
    </svg>`);

  const corners = oneline(`
    <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none"
         style="position:absolute;inset:0.35in;pointer-events:none;z-index:3;"
         viewBox="0 0 400 600">
      <circle cx="200" cy="22" r="3" fill="none" stroke="${ac}" stroke-opacity="0.7" stroke-width="0.7"/>
      <circle cx="200" cy="578" r="3" fill="none" stroke="${ac}" stroke-opacity="0.7" stroke-width="0.7"/>
    </svg>`);

  const spineOrnament = "";

  const backBanner = oneline(`
    <div style="display:flex;justify-content:center;margin-bottom:14px;font-family:'Playfair Display',Georgia,serif;
                font-size:10px;letter-spacing:5px;color:${ac};text-transform:lowercase;font-style:italic;opacity:0.82;">
      <span>&nbsp;&nbsp;breathe&nbsp;·&nbsp;solve&nbsp;·&nbsp;release&nbsp;&nbsp;</span>
    </div>`);

  return {
    texture,
    border,
    corners,
    spineOrnament,
    backBanner,
    heroFilter: "brightness(1.05) saturate(0.85) contrast(0.96)",
    fingerprint: "mindful-serene",
  };
}

// ────────────────────────────────────────────────────────────────────────────
// Public API
// ────────────────────────────────────────────────────────────────────────────

/**
 * Produce the composite SVG/HTML layers for an Experience Mode.
 *
 * Pass the mode + the cover's accent hex and background hex. The returned
 * layers are inline HTML/SVG strings that buildCoverHTML can drop into the
 * front panel at the correct z-index. All layers are pointer-events:none so
 * they never interfere with back-cover text selection.
 */
export function experienceCoverLayers(
  mode: ExperienceMode | string | undefined,
  accent: string,
  _background: string,
): ExperienceLayers {
  const ac = accent || "#b8860b";
  switch ((mode || "standard").toLowerCase()) {
    case "sketch":
      return sketchLayers(ac);
    case "detective":
      return detectiveLayers(ac);
    case "adventure":
      return adventureLayers(ac);
    case "darkacademia":
    case "dark-academia":
      return darkAcademiaLayers(ac);
    case "cozycottage":
    case "cozy-cottage":
    case "cozy":
      return cozyCottageLayers(ac);
    case "mindful":
    case "mindfulwellness":
      return mindfulLayers(ac);
    default:
      return EMPTY;
  }
}

/**
 * Render the author-persona monogram as an inline SVG block scaled for a
 * given placement. Used on the spine and as a corner mark on the back cover.
 */
export function renderMonogramBlock(
  monogramSvg: string,
  placement: "spine" | "back-corner" | "back-bio",
): string {
  if (!monogramSvg || monogramSvg.trim().length === 0) return "";
  const sizeMap = {
    spine: "width:0.35in;height:0.35in;",
    "back-corner": "width:0.55in;height:0.55in;",
    "back-bio": "width:0.7in;height:0.7in;",
  } as const;
  const box = sizeMap[placement] || sizeMap["back-corner"];
  // The monogram SVG was generated at 100×100 viewBox — wrap it in a sized div.
  return `<div style="${box}display:inline-block;flex-shrink:0;">${monogramSvg}</div>`;
}

/**
 * Render a reserved barcode-safe zone for the back cover. KDP reserves a
 * 2.0" × 1.2" white zone bottom-right of the back panel. Putting this div
 * at that position prevents any decoration or image from bleeding into it.
 */
export function barcodeSafeZone(): string {
  return `<div aria-hidden="true" style="position:absolute;right:0.3in;bottom:0.3in;width:2in;height:1.2in;background:#fff;border:0.5px solid rgba(0,0,0,0.08);z-index:8;"></div>`;
}
