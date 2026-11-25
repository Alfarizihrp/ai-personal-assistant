import { createHash, timingSafeEqual } from "node:crypto";

interface AttemptRecord {
  failures: number;
  resetAt: number;
}

const DEFAULT_MAX_ATTEMPTS = 5;
const DEFAULT_WINDOW_MS = 15 * 60 * 1000;

export class PinRateLimiter {
  private readonly store = new Map<string, AttemptRecord>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts = DEFAULT_MAX_ATTEMPTS, windowMs = DEFAULT_WINDOW_MS) {
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  check(key: string, now = Date.now()): { allowed: boolean; retryAfterSeconds: number; remaining: number } {
    const entry = this.store.get(key);
    if (!entry || now >= entry.resetAt) {
      if (entry && now >= entry.resetAt) {
        this.store.delete(key);
      }
      return { allowed: true, retryAfterSeconds: 0, remaining: this.maxAttempts };
    }

    if (entry.failures >= this.maxAttempts) {
      const retryAfterSeconds = Math.max(1, Math.ceil((entry.resetAt - now) / 1000));
      return { allowed: false, retryAfterSeconds, remaining: 0 };
    }

    return {
      allowed: true,
      retryAfterSeconds: 0,
      remaining: Math.max(0, this.maxAttempts - entry.failures),
    };
  }

  recordFailure(key: string, now = Date.now()): { blocked: boolean; remaining: number; retryAfterSeconds: number } {
    const existing = this.store.get(key);
    const entry: AttemptRecord =
      existing && now < existing.resetAt
        ? { failures: existing.failures + 1, resetAt: existing.resetAt }
        : { failures: 1, resetAt: now + this.windowMs };

    this.store.set(key, entry);

    const blocked = entry.failures >= this.maxAttempts;
    const retryAfterSeconds = blocked ? Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) : 0;
    return {
      blocked,
      remaining: Math.max(0, this.maxAttempts - entry.failures),
      retryAfterSeconds,
    };
  }

  reset(key: string): void {
    this.store.delete(key);
  }
}

export const pinRateLimiter = new PinRateLimiter();

/**
 * Membandingkan PIN dengan timing-safe comparison setelah di-hash SHA-256
 * agar panjang string tidak membocorkan informasi dan terhindar dari timing attack.
 */
export function verifyPinTimingSafe(inputPin: string, expectedPin: string): boolean {
  const normalizedInput = String(inputPin).trim();
  const normalizedExpected = String(expectedPin).trim();
  if (!normalizedInput || !normalizedExpected) return false;

  const inputDigest = createHash("sha256").update(normalizedInput).digest();
  const expectedDigest = createHash("sha256").update(normalizedExpected).digest();
  return timingSafeEqual(inputDigest, expectedDigest);
}

export function getClientIdentifier(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const firstIp = forwarded.split(",")[0]?.trim();
    if (firstIp) return firstIp;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "local-client";
}
