/**
 * Council output cache.
 *
 * Most council outputs are stable for a given (niche, puzzleType, difficulty,
 * largePrint) tuple. Repeat generations in the same niche recompute the same
 * answer from the same inputs — a waste of LLM spend. This module caches those
 * outputs in Postgres with a 24h TTL by default.
 *
 * Every cache operation fails open: a missing cache table, connection
 * timeout, or JSON error never blocks the pipeline. The cache is a pure
 * optimization, not a correctness dependency.
 */

import { sql } from "drizzle-orm";
import { db } from "./index";

// ── Deterministic cache key ──────────────────────────────────────────────────

/**
 * Build a stable string key from a record of primitives. Sorts keys, stringifies
 * objects consistently. Same inputs always produce the same key across JS engines.
 */
export function stableKey(input: Record<string, unknown>): string {
  const keys = Object.keys(input).sort();
  const parts = keys.map(k => {
    const v = input[k];
    if (v === null || v === undefined) return `${k}:∅`;
    if (typeof v === "object") return `${k}:${JSON.stringify(v)}`;
    if (typeof v === "string") return `${k}:${v.toLowerCase().trim()}`;
    return `${k}:${String(v)}`;
  });
  return parts.join("|");
}

// ── Read ─────────────────────────────────────────────────────────────────────

export async function getCached<T>(agent: string, key: string): Promise<T | null> {
  try {
    const rows = await db.execute(sql`
      SELECT output_json FROM council_cache
      WHERE agent = ${agent} AND cache_key = ${key} AND expires_at > NOW()
      LIMIT 1
    `);
    const result = rows as unknown as { rows?: Array<{ output_json: unknown }> };
    const first = result.rows?.[0];
    if (first && first.output_json !== null && first.output_json !== undefined) {
      return first.output_json as T;
    }
    return null;
  } catch {
    // Table missing, connection issue, or any other read error —
    // silently fall through to let the agent run.
    return null;
  }
}

// ── Write ────────────────────────────────────────────────────────────────────

export async function setCached<T>(
  agent: string,
  key: string,
  value: T,
  ttlHours: number = 24,
): Promise<void> {
  if (value === null || value === undefined) return;
  try {
    const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000);
    await db.execute(sql`
      INSERT INTO council_cache (agent, cache_key, output_json, expires_at)
      VALUES (${agent}, ${key}, ${JSON.stringify(value)}::jsonb, ${expiresAt})
      ON CONFLICT (agent, cache_key) DO UPDATE
      SET output_json = EXCLUDED.output_json,
          expires_at = EXCLUDED.expires_at,
          created_at = NOW()
    `);
  } catch {
    // Write errors are non-fatal — the agent already returned a correct value
    // for this request; caching it for next time is a bonus.
  }
}

// ── Convenience wrapper ─────────────────────────────────────────────────────

/**
 * Run the agent with transparent caching. Lookup → miss → run → store → return.
 * On a hit, the agent never runs. On a miss, the result is stored for ttlHours.
 *
 * @param agent  canonical agent name, e.g. "buyer-psychology"
 * @param key    stable key from stableKey(inputs)
 * @param fn     thunk that runs the real agent
 * @param ttlHours 24h default — niche-stable data rarely changes within a day
 */
export async function cachedRun<T>(
  agent: string,
  key: string,
  fn: () => Promise<T>,
  ttlHours: number = 24,
): Promise<T> {
  const hit = await getCached<T>(agent, key);
  if (hit !== null && hit !== undefined) return hit;
  const result = await fn();
  // Fire-and-forget the write; don't block the caller on cache storage.
  void setCached(agent, key, result, ttlHours);
  return result;
}

// ── Diagnostics ─────────────────────────────────────────────────────────────

export async function clearCache(agent?: string): Promise<number> {
  try {
    if (agent) {
      const r = await db.execute(sql`DELETE FROM council_cache WHERE agent = ${agent}`);
      return (r as unknown as { rowCount?: number }).rowCount ?? 0;
    }
    const r = await db.execute(sql`DELETE FROM council_cache`);
    return (r as unknown as { rowCount?: number }).rowCount ?? 0;
  } catch {
    return 0;
  }
}

export async function cacheStats(): Promise<{ total: number; byAgent: Record<string, number> }> {
  try {
    const all = await db.execute(sql`
      SELECT agent, COUNT(*)::int AS n FROM council_cache
      WHERE expires_at > NOW() GROUP BY agent
    `);
    const rows = (all as unknown as { rows?: Array<{ agent: string; n: number }> }).rows ?? [];
    const byAgent: Record<string, number> = {};
    let total = 0;
    for (const r of rows) {
      byAgent[r.agent] = r.n;
      total += r.n;
    }
    return { total, byAgent };
  } catch {
    return { total: 0, byAgent: {} };
  }
}
