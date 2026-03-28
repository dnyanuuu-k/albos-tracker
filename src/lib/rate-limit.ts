/**
 * In-memory rate limiting using sliding window algorithm
 * For production, consider using Redis for distributed rate limiting
 */

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private requests: Map<string, RateLimitEntry> = new Map();
  private maxRequests: number;
  private windowMs: number;

  constructor(maxRequests: number = 100, windowMs: number = 60 * 1000) {
    this.maxRequests = maxRequests;
    this.windowMs = windowMs;
    
    // Clean up old entries every minute
    setInterval(() => this.cleanup(), 60 * 1000);
  }

  /**
   * Check if a request should be allowed
   * @param identifier - Unique identifier (e.g., IP address, email, user ID)
   * @returns true if allowed, false if rate limit exceeded
   */
  check(identifier: string): boolean {
    const now = Date.now();
    const entry = this.requests.get(identifier);

    if (!entry || now > entry.resetTime) {
      // First request or window expired, reset counter
      this.requests.set(identifier, {
        count: 1,
        resetTime: now + this.windowMs,
      });
      return true;
    }

    if (entry.count >= this.maxRequests) {
      // Rate limit exceeded
      return false;
    }

    // Increment counter
    entry.count++;
    return true;
  }

  /**
   * Get remaining requests and reset time for an identifier
   */
  getStatus(identifier: string): { remaining: number; resetTime: number } {
    const entry = this.requests.get(identifier);
    const now = Date.now();

    if (!entry || now > entry.resetTime) {
      return {
        remaining: this.maxRequests,
        resetTime: now + this.windowMs,
      };
    }

    return {
      remaining: Math.max(0, this.maxRequests - entry.count),
      resetTime: entry.resetTime,
    };
  }

  /**
   * Reset the rate limit for an identifier
   */
  reset(identifier: string): void {
    this.requests.delete(identifier);
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [identifier, entry] of this.requests.entries()) {
      if (now > entry.resetTime) {
        this.requests.delete(identifier);
      }
    }
  }
}

// Create instances for different endpoints
export const authRateLimiter = new RateLimiter(5, 60 * 1000); // 5 requests per minute for auth
export const generalRateLimiter = new RateLimiter(100, 60 * 1000); // 100 requests per minute general

/**
 * Rate limit middleware for API routes
 */
export function createRateLimitMiddleware(limiter: RateLimiter, getIdentifier: (req: Request) => string) {
  return async (req: Request) => {
    const identifier = getIdentifier(req);
    
    if (!limiter.check(identifier)) {
      const status = limiter.getStatus(identifier);
      const retryAfter = Math.ceil((status.resetTime - Date.now()) / 1000);
      
      return {
        allowed: false,
        retryAfter,
      };
    }
    
    return { allowed: true };
  };
}

/**
 * Get client IP address from request
 */
export function getClientIP(req: Request): string {
  // Try various headers for IP address
  const forwarded = req.headers.get('x-forwarded-for');
  const realIP = req.headers.get('x-real-ip');
  const cfConnectingIP = req.headers.get('cf-connecting-ip');
  
  return (forwarded?.split(',')[0] || realIP || cfConnectingIP || 'unknown');
}
