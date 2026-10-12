// Tracks how much of Groq's free daily allowance this app has used, so
// the person can see roughly how many AI retags are left before Groq
// stops answering.
//
// What Groq tells us, and what it doesn't:
//  - REAL numbers from Groq: requests-per-day remaining (response header),
//    and the tokens each call used (response body).
//  - NOT reported by Groq: the daily token balance. So tokens used today
//    is a running total of this app's own calls on this device, compared
//    against the daily token limit (200,000 on the free tier). Usage from
//    other devices, other apps or the Groq console is invisible here, so
//    the count is an estimate, and a real "limit reached" error always
//    overrides it.

import type { GroqUsageSnapshot } from "./groq";

const STORAGE_KEY = "racks-groq-quota-v1";
export const QUOTA_EVENT = "racks-groq-quota-changed";

/** Free-tier daily token limit seen in Groq's own 429 messages. */
export const DEFAULT_DAILY_TOKEN_LIMIT = 200_000;
/** Used until at least one real call has been measured. */
const FALLBACK_TOKENS_PER_RETAG = 2_000;
const RECENT_WINDOW = 20;

interface StoredQuota {
  /** UTC day this tally belongs to, YYYY-MM-DD. */
  day: string;
  tokensToday: number;
  callsToday: number;
  /** Tokens of the most recent calls, for a rolling average. */
  recent: number[];
  limitRequests: number | null;
  remainingRequests: number | null;
  /** Set when Groq itself said the daily cap was hit. */
  limitHitAt: number | null;
  /** Breakdown of the most recent AI action, for the details panel. */
  last: { tokens: number; prompt: number; completion: number; reasoning: number; attempts: number } | null;
}

export interface QuotaEstimate {
  tokensToday: number;
  callsToday: number;
  dailyTokenLimit: number;
  tokensLeft: number;
  avgTokensPerRetag: number;
  /** True once at least one real call has been measured. */
  measured: boolean;
  /** The most recent AI action's token breakdown, if any. */
  last: StoredQuota["last"];
  /** Real remaining-requests number from Groq, when known. */
  requestsLeft: number | null;
  /** Best estimate of AI retags left; 0 when Groq reported the cap hit. */
  retagsLeft: number;
  limitReached: boolean;
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function blank(): StoredQuota {
  return {
    day: today(),
    tokensToday: 0,
    callsToday: 0,
    recent: [],
    limitRequests: null,
    remainingRequests: null,
    limitHitAt: null,
    last: null,
  };
}

function read(): StoredQuota {
  try {
    const raw = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
    if (!raw) return blank();
    const parsed = JSON.parse(raw) as Partial<StoredQuota>;
    const base = blank();
    const stored: StoredQuota = {
      day: typeof parsed?.day === "string" ? parsed.day : base.day,
      tokensToday: Number(parsed?.tokensToday) || 0,
      callsToday: Number(parsed?.callsToday) || 0,
      recent: Array.isArray(parsed?.recent) ? parsed.recent.map(Number).filter((n) => n > 0) : [],
      limitRequests: parsed?.limitRequests ?? null,
      remainingRequests: parsed?.remainingRequests ?? null,
      limitHitAt: parsed?.limitHitAt ?? null,
      last: parsed?.last ?? null,
    };
    // New UTC day: the daily tally and any "limit hit" flag reset, but the
    // measured per-retag average carries over.
    if (stored.day !== base.day) {
      return { ...blank(), recent: stored.recent };
    }
    return stored;
  } catch {
    return blank();
  }
}

function write(q: StoredQuota) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(q));
    window.dispatchEvent(new Event(QUOTA_EVENT));
  } catch {
    // Storage can be blocked (private mode); the badge just stays empty.
  }
}

/** Records one successful AI call's usage from an API response body. */
export function recordGroqUsage(usage: GroqUsageSnapshot | null | undefined) {
  if (!usage || typeof window === "undefined") return;
  const tokens = Number(usage.tokens) || 0;
  if (tokens <= 0) return;
  const q = read();
  q.tokensToday += tokens;
  q.callsToday += 1;
  q.recent = [...q.recent, tokens].slice(-RECENT_WINDOW);
  q.last = {
    tokens,
    prompt: Number(usage.promptTokens) || 0,
    completion: Number(usage.completionTokens) || 0,
    reasoning: Number(usage.reasoningTokens) || 0,
    attempts: Number(usage.attempts) || 1,
  };
  if (usage.limitRequests != null) q.limitRequests = usage.limitRequests;
  if (usage.remainingRequests != null) q.remainingRequests = usage.remainingRequests;
  write(q);
}

/** Call with an API error message; flags the cap when Groq says it's hit. */
export function recordGroqError(message: unknown) {
  if (typeof window === "undefined") return;
  const text = String(message || "");
  if (/daily usage limit|per-day cap|longer cooldown/i.test(text)) {
    const q = read();
    q.limitHitAt = Date.now();
    write(q);
  }
}

export function estimateQuota(dailyTokenLimit = DEFAULT_DAILY_TOKEN_LIMIT): QuotaEstimate {
  const q = read();
  const measured = q.recent.length > 0;
  const avg = measured
    ? Math.round(q.recent.reduce((a, b) => a + b, 0) / q.recent.length)
    : FALLBACK_TOKENS_PER_RETAG;
  const tokensLeft = Math.max(0, dailyTokenLimit - q.tokensToday);
  const byTokens = Math.floor(tokensLeft / Math.max(1, avg));
  const byRequests = q.remainingRequests;
  const limitReached = q.limitHitAt !== null;
  const retagsLeft = limitReached
    ? 0
    : Math.max(0, byRequests != null ? Math.min(byTokens, byRequests) : byTokens);
  return {
    tokensToday: q.tokensToday,
    callsToday: q.callsToday,
    dailyTokenLimit,
    tokensLeft,
    avgTokensPerRetag: avg,
    measured,
    last: q.last,
    requestsLeft: byRequests,
    retagsLeft,
    limitReached,
  };
}

/** Raw stored string, for useSyncExternalStore (stable between changes). */
export function quotaSnapshot(): string {
  try {
    return typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) || "" : "";
  } catch {
    return "";
  }
}

export function subscribeQuota(callback: () => void): () => void {
  window.addEventListener(QUOTA_EVENT, callback);
  window.addEventListener("storage", callback);
  return () => {
    window.removeEventListener(QUOTA_EVENT, callback);
    window.removeEventListener("storage", callback);
  };
}
