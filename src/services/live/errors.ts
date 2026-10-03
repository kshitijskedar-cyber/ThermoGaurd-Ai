export type LiveErrorCode = "not_configured" | "network" | "timeout" | "http" | "rate_limited" | "auth" | "bad_response" | "partial";

/**
 * Failure of a live source. `userMessage` is safe to show (no URLs, keys or stack traces); `detail` is for the console only.
 * Browsers report a blocked cross-origin request, an offline machine and a server error without CORS headers identically
 * ("Failed to fetch"), so `network` deliberately covers all three.
 */
export class LiveSourceError extends Error {
  constructor(public code: LiveErrorCode, public userMessage: string, public detail?: string) {
    super(detail ?? userMessage);
    this.name = "LiveSourceError";
  }
}

export const isAbort = (e: unknown) => e instanceof DOMException && e.name === "AbortError";
