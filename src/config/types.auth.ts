export type AuthProfileConfig = {
  provider: string;
  /**
   * Credential type expected in auth-profiles.json for this profile id.
   * - api_key: static provider API key
   * - oauth: refreshable OAuth credentials (access+refresh+expires)
   * - token: static bearer-style token (optionally expiring; no refresh)
   */
  mode: "api_key" | "oauth" | "token";
  email?: string;
};

export type AuthConfig = {
  profiles?: Record<string, AuthProfileConfig>;
  order?: Record<string, string[]>;
  broker?: {
    /** Enable the Auth Broker (default: true). */
    enabled?: boolean;
    /** Prefer OAuth/token credentials over API keys (default: true). */
    oauthFirst?: boolean;
    /** Allow API key fallback when OAuth/token is unavailable (default: true). */
    allowApiKeyFallback?: boolean;
    /** Provider priority list for the broker. */
    providers?: string[];
    /** Preferred provider override (must be in providers list). */
    preferredProvider?: string;
  };
  cooldowns?: {
    /** Default billing backoff (hours). Default: 5. */
    billingBackoffHours?: number;
    /** Optional per-provider billing backoff (hours). */
    billingBackoffHoursByProvider?: Record<string, number>;
    /** Billing backoff cap (hours). Default: 24. */
    billingMaxHours?: number;
    /**
     * Failure window for backoff counters (hours). If no failures occur within
     * this window, counters reset. Default: 24.
     */
    failureWindowHours?: number;
  };
};
