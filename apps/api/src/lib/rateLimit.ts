import { Ratelimit } from "@upstash/ratelimit";
import { redis } from "./redis";

// Set comfortably below Gemini's own free-tier rate limit, so a user who
// sends messages too fast hits this friendly limiter first, rather than an
// opaque 429 from Google's API bubbling up through the agent loop.
export const chatRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(8, "1 m"),
  prefix: "ratelimit:chat:user",
  analytics: true,
});

// Looser cap per IP — catches abuse across multiple accounts behind one
// address without punishing ordinary users sharing a NAT (offices, campus
// wifi) who each have their own, separately-limited account.
export const chatIpRateLimit = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(20, "1 m"),
  prefix: "ratelimit:chat:ip",
  analytics: true,
});