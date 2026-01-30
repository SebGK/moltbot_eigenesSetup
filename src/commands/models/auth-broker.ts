import { select as clackSelect } from "@clack/prompts";

import { DEFAULT_MODEL, DEFAULT_PROVIDER } from "../../agents/defaults.js";
import {
  DEFAULT_AUTH_BROKER_PROVIDERS,
  resolveAuthBrokerConfig,
  resolveBrokerPreferredProvider,
} from "../../agents/auth-broker.js";
import { ensureAuthProfileStore } from "../../agents/auth-profiles.js";
import { resolveDefaultAgentId, resolveAgentDir } from "../../agents/agent-scope.js";
import type { MoltbotConfig } from "../../config/config.js";
import { readConfigFileSnapshot, writeConfigFile } from "../../config/config.js";
import { logConfigUpdated } from "../../config/logging.js";
import type { RuntimeEnv } from "../../runtime.js";
import { stylePromptHint, stylePromptMessage } from "../../terminal/prompt-style.js";
import { resolveProviderAuthOverview } from "./list.auth-overview.js";
import { resolveMoltbotAgentDir } from "../../agents/agent-paths.js";
import { applyAuthChoice } from "../auth-choice.js";
import { createClackPrompter } from "../../wizard/clack-prompter.js";
import { applyOpenAICodexModelDefault } from "../openai-codex-model-default.js";
import { applyGoogleGeminiModelDefault } from "../google-gemini-model-default.js";
import { applyOpenrouterConfig } from "../onboard-auth.js";
import { normalizeProviderId } from "../../agents/model-selection.js";

const select = <T>(params: Parameters<typeof clackSelect<T>>[0]) =>
  clackSelect({
    ...params,
    message: stylePromptMessage(params.message),
    options: params.options.map((opt) =>
      opt.hint === undefined ? opt : { ...opt, hint: stylePromptHint(opt.hint) },
    ),
  });

function resolveBrokerProviders(cfg: MoltbotConfig): string[] {
  const broker = resolveAuthBrokerConfig(cfg);
  return broker.providers.length > 0 ? broker.providers : DEFAULT_AUTH_BROKER_PROVIDERS;
}

function applyBrokerPreferredProvider(cfg: MoltbotConfig, provider: string): MoltbotConfig {
  return {
    ...cfg,
    auth: {
      ...cfg.auth,
      broker: {
        ...cfg.auth?.broker,
        preferredProvider: provider,
      },
    },
  };
}

function applyProviderDefault(cfg: MoltbotConfig, provider: string): MoltbotConfig {
  if (provider === "openai-codex") {
    return applyOpenAICodexModelDefault(cfg).next;
  }
  if (provider === "google-gemini-cli") {
    return applyGoogleGeminiModelDefault(cfg).next;
  }
  if (provider === "openrouter") {
    return applyOpenrouterConfig(cfg);
  }
  if (provider === "anthropic") {
    return {
      ...cfg,
      agents: {
        ...cfg.agents,
        defaults: {
          ...cfg.agents?.defaults,
          model: {
            ...(typeof cfg.agents?.defaults?.model === "object"
              ? { fallbacks: cfg.agents.defaults.model.fallbacks }
              : undefined),
            primary: `${DEFAULT_PROVIDER}/${DEFAULT_MODEL}`,
          },
        },
      },
    };
  }
  return cfg;
}

export async function modelsAuthBrokerStatusCommand(
  opts: { json?: boolean },
  runtime: RuntimeEnv,
) {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    throw new Error(`Invalid config at ${snapshot.path}`);
  }
  const cfg = snapshot.config;
  const broker = resolveAuthBrokerConfig(cfg);
  const agentDir = resolveMoltbotAgentDir();
  const store = ensureAuthProfileStore();
  const modelsPath = `${agentDir}/models.json`;
  const providers = resolveBrokerProviders(cfg);
  const preferred = resolveBrokerPreferredProvider(cfg);
  const authOverview = providers.map((provider) =>
    resolveProviderAuthOverview({ provider, cfg, store, modelsPath }),
  );

  if (opts.json) {
    runtime.log(
      JSON.stringify(
        {
          enabled: broker.enabled,
          oauthFirst: broker.oauthFirst,
          allowApiKeyFallback: broker.allowApiKeyFallback,
          providers,
          preferredProvider: preferred ?? null,
          providerAuth: authOverview,
        },
        null,
        2,
      ),
    );
    return;
  }

  runtime.log(`Auth Broker: ${broker.enabled ? "enabled" : "disabled"}`);
  runtime.log(`OAuth-first: ${broker.oauthFirst ? "on" : "off"}`);
  runtime.log(`API key fallback: ${broker.allowApiKeyFallback ? "allowed" : "blocked"}`);
  runtime.log(`Providers: ${providers.join(", ")}`);
  runtime.log(`Preferred provider: ${preferred ?? "(none)"}`);
  runtime.log("");
  for (const entry of authOverview) {
    runtime.log(`${entry.provider}: ${entry.effective.detail}`);
  }
}

export async function modelsAuthBrokerUseCommand(
  opts: { provider?: string; setDefault?: boolean },
  runtime: RuntimeEnv,
) {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    throw new Error(`Invalid config at ${snapshot.path}`);
  }
  const cfg = snapshot.config;
  const providers = resolveBrokerProviders(cfg);
  const provider = opts.provider?.trim() ? normalizeProviderId(opts.provider.trim()) : undefined;
  const nextProvider =
    provider && providers.includes(provider)
      ? provider
      : await select({
          message: "Select preferred provider",
          options: providers.map((value) => ({ value, label: value })),
        });
  if (typeof nextProvider !== "string") return;

  let next = applyBrokerPreferredProvider(cfg, nextProvider);
  if (opts.setDefault ?? true) {
    next = applyProviderDefault(next, nextProvider);
  }
  await writeConfigFile(next);
  logConfigUpdated(runtime);
  runtime.log(`Preferred provider set to ${nextProvider}`);
}

export async function modelsAuthBrokerLoginCommand(
  opts: { provider?: string; setDefault?: boolean },
  runtime: RuntimeEnv,
) {
  const snapshot = await readConfigFileSnapshot();
  if (!snapshot.valid) {
    throw new Error(`Invalid config at ${snapshot.path}`);
  }
  const cfg = snapshot.config;
  const providers = resolveBrokerProviders(cfg);
  const provider = opts.provider?.trim()
    ? normalizeProviderId(opts.provider.trim())
    : await select({
        message: "Select provider to authenticate",
        options: providers.map((value) => ({ value, label: value })),
      });
  if (typeof provider !== "string") return;

  const prompter = createClackPrompter();
  const authChoice =
    provider === "openai-codex"
      ? "openai-codex"
      : provider === "google-gemini-cli"
        ? "google-gemini-cli"
        : provider === "openrouter"
          ? "openrouter-oauth"
          : "token";

  const agentId = resolveDefaultAgentId(cfg);
  const agentDir = resolveAgentDir(cfg, agentId);
  const result = await applyAuthChoice({
    authChoice,
    config: cfg,
    prompter,
    runtime,
    agentDir,
    agentId,
    setDefaultModel: Boolean(opts.setDefault),
  });

  await writeConfigFile(result.config);
  logConfigUpdated(runtime);
  runtime.log(`Auth broker login complete for ${provider}.`);
}
