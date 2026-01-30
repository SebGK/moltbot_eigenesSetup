import type { MoltbotConfig } from "../config/config.js";
import { normalizeProviderId } from "./model-selection.js";

export type AuthBrokerConfig = {
  enabled: boolean;
  oauthFirst: boolean;
  allowApiKeyFallback: boolean;
  providers: string[];
  preferredProvider?: string;
};

export const DEFAULT_AUTH_BROKER_PROVIDERS = [
  "openai-codex",
  "anthropic",
  "google-gemini-cli",
  "openrouter",
];

function normalizeProviderList(values: string[] | undefined): string[] {
  const list = Array.isArray(values) ? values : [];
  const normalized = list
    .map((value) => normalizeProviderId(String(value ?? "")))
    .map((value) => value.trim())
    .filter(Boolean);
  const deduped: string[] = [];
  for (const entry of normalized) {
    if (!deduped.includes(entry)) deduped.push(entry);
  }
  return deduped;
}

export function resolveAuthBrokerConfig(cfg?: MoltbotConfig): AuthBrokerConfig {
  const broker = cfg?.auth?.broker;
  const enabled = broker?.enabled ?? true;
  const oauthFirst = broker?.oauthFirst ?? true;
  const allowApiKeyFallback = broker?.allowApiKeyFallback ?? true;
  const providers =
    normalizeProviderList(broker?.providers) ??
    normalizeProviderList(DEFAULT_AUTH_BROKER_PROVIDERS);
  const fallbackProviders =
    providers.length > 0 ? providers : DEFAULT_AUTH_BROKER_PROVIDERS.map(normalizeProviderId);
  const preferredRaw = broker?.preferredProvider?.trim();
  const preferredProvider = preferredRaw ? normalizeProviderId(preferredRaw) : undefined;
  return {
    enabled,
    oauthFirst,
    allowApiKeyFallback,
    providers: fallbackProviders,
    preferredProvider,
  };
}

export function resolveBrokerPreferredProvider(cfg?: MoltbotConfig): string | undefined {
  const broker = resolveAuthBrokerConfig(cfg);
  if (!broker.enabled) return undefined;
  if (broker.preferredProvider && broker.providers.includes(broker.preferredProvider)) {
    return broker.preferredProvider;
  }
  return broker.providers[0];
}
