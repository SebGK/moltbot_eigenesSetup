import { isRemoteEnvironment } from "./oauth-env.js";
import type { ApplyAuthChoiceParams, ApplyAuthChoiceResult } from "./auth-choice.apply.js";
import { loginChutes } from "./chutes-oauth.js";
import { createVpsAwareOAuthHandlers } from "./oauth-flow.js";
import { applyAuthProfileConfig, setOpenrouterToken, writeOAuthCredentials } from "./onboard-auth.js";
import { openUrl } from "./onboard-helpers.js";
import { loginOpenRouterOAuth } from "./openrouter-oauth.js";

export async function applyAuthChoiceOAuth(
  params: ApplyAuthChoiceParams,
): Promise<ApplyAuthChoiceResult | null> {
  if (params.authChoice === "chutes") {
    let nextConfig = params.config;
    const isRemote = isRemoteEnvironment();
    const redirectUri =
      process.env.CHUTES_OAUTH_REDIRECT_URI?.trim() || "http://127.0.0.1:1456/oauth-callback";
    const scopes = process.env.CHUTES_OAUTH_SCOPES?.trim() || "openid profile chutes:invoke";
    const clientId =
      process.env.CHUTES_CLIENT_ID?.trim() ||
      String(
        await params.prompter.text({
          message: "Enter Chutes OAuth client id",
          placeholder: "cid_xxx",
          validate: (value) => (value?.trim() ? undefined : "Required"),
        }),
      ).trim();
    const clientSecret = process.env.CHUTES_CLIENT_SECRET?.trim() || undefined;

    await params.prompter.note(
      isRemote
        ? [
            "You are running in a remote/VPS environment.",
            "A URL will be shown for you to open in your LOCAL browser.",
            "After signing in, paste the redirect URL back here.",
            "",
            `Redirect URI: ${redirectUri}`,
          ].join("\n")
        : [
            "Browser will open for Chutes authentication.",
            "If the callback doesn't auto-complete, paste the redirect URL.",
            "",
            `Redirect URI: ${redirectUri}`,
          ].join("\n"),
      "Chutes OAuth",
    );

    const spin = params.prompter.progress("Starting OAuth flow…");
    try {
      const { onAuth, onPrompt } = createVpsAwareOAuthHandlers({
        isRemote,
        prompter: params.prompter,
        runtime: params.runtime,
        spin,
        openUrl,
        localBrowserMessage: "Complete sign-in in browser…",
      });

      const creds = await loginChutes({
        app: {
          clientId,
          clientSecret,
          redirectUri,
          scopes: scopes.split(/\s+/).filter(Boolean),
        },
        manual: isRemote,
        onAuth,
        onPrompt,
        onProgress: (msg) => spin.update(msg),
      });

      spin.stop("Chutes OAuth complete");
      const email = creds.email?.trim() || "default";
      const profileId = `chutes:${email}`;

      await writeOAuthCredentials("chutes", creds, params.agentDir);
      nextConfig = applyAuthProfileConfig(nextConfig, {
        profileId,
        provider: "chutes",
        mode: "oauth",
      });
    } catch (err) {
      spin.stop("Chutes OAuth failed");
      params.runtime.error(String(err));
      await params.prompter.note(
        [
          "Trouble with OAuth?",
          "Verify CHUTES_CLIENT_ID (and CHUTES_CLIENT_SECRET if required).",
          `Verify the OAuth app redirect URI includes: ${redirectUri}`,
          "Chutes docs: https://chutes.ai/docs/sign-in-with-chutes/overview",
        ].join("\n"),
        "OAuth help",
      );
    }
    return { config: nextConfig };
  }

  if (params.authChoice === "openrouter-oauth") {
    let nextConfig = params.config;
    const isRemote = isRemoteEnvironment();
    const spin = params.prompter.progress("Starting OAuth flow…");
    try {
      const creds = await loginOpenRouterOAuth({
        isRemote,
        openUrl,
        log: (message) => params.runtime.log(message),
        note: params.prompter.note,
        prompt: async (message) => String(await params.prompter.text({ message })),
        progress: spin,
      });
      spin.stop("OpenRouter OAuth complete");

      const profileId = `openrouter:${creds.userId ?? "oauth"}`;
      await setOpenrouterToken({ token: creds.apiKey, profileId, agentDir: params.agentDir });
      nextConfig = applyAuthProfileConfig(nextConfig, {
        profileId,
        provider: "openrouter",
        mode: "token",
      });
    } catch (err) {
      spin.stop("OpenRouter OAuth failed");
      params.runtime.error(String(err));
      await params.prompter.note(
        [
          "Trouble with OAuth?",
          "Verify OPENROUTER_OAUTH_REDIRECT_URI if you customized it.",
          "OpenRouter docs: https://openrouter.ai/docs/api-reference/authentication",
        ].join("\n"),
        "OAuth help",
      );
    }
    return { config: nextConfig };
  }

  return null;
}
