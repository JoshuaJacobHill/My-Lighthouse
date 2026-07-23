/**
 * Minimal in-memory rate limiter (fixed window).
 *
 * Defence-in-depth against naive floods — e.g. someone hammering the public
 * donate endpoint to spin up endless Stripe sessions. It is per-process, so on
 * serverless it limits per instance, not globally. For production-grade limiting
 * across instances, back this with a shared store (e.g. Upstash Redis). It is
 * intentionally simple and dependency-free.
 */

type Bucket = { count: number; resetAt: number }

const buckets = new Map<string, Bucket>()

export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterSeconds: number } {
  const now = Date.now()
  const bucket = buckets.get(key)

  if (!bucket || now > bucket.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    // Opportunistic cleanup so the map can't grow unbounded.
    if (buckets.size > 5000) {
      for (const [k, b] of buckets) if (now > b.resetAt) buckets.delete(k)
    }
    return { ok: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= limit) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count += 1
  return { ok: true, retryAfterSeconds: 0 }
}
