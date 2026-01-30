import { createHash, randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { URL } from "node:url";

const OPENROUTER_AUTH_URL = "https://openrouter.ai/auth";
const OPENROUTER_KEYS_URL = "https://openrouter.ai/api/v1/auth/keys";
const DEFAULT_REDIRECT_URI = "http://localhost:3000/openrouter-oauth";

export type OpenRouterOAuthResult = {
  apiKey: string;
  keyId?: string;
  userId?: string;
};

export type OpenRouterOAuthContext = {
  isRemote: boolean;
  openUrl: (url: string) => Promise<void>;
  log: (msg: string) => void;
  note: (message: string, title?: string) => Promise<void>;
  prompt: (message: string) => Promise<string>;
  progress: { update: (msg: string) => void; stop: (msg?: string) => void };
};

function generatePkce(): { verifier: string; challenge: string } {
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  return { verifier, challenge };
}

function buildAuthUrl(params: { redirectUri: string; challenge: string }): string {
  const url = new URL(OPENROUTER_AUTH_URL);
  url.searchParams.set("callback_url", params.redirectUri);
  url.searchParams.set("code_challenge", params.challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

function parseCallbackInput(input: string): { code: string } | { error: string } {
  const trimmed = input.trim();
  if (!trimmed) return { error: "No input provided" };
  try {
    const url = new URL(trimmed);
    const error = url.searchParams.get("error");
    if (error) return { error };
    const code = url.searchParams.get("code");
    if (!code) return { error: "Missing code in redirect URL" };
    return { code };
  } catch {
    return { error: "Paste the full redirect URL (not just the code)." };
  }
}

async function waitForLocalCallback(params: {
  redirectUri: string;
  timeoutMs: number;
  onProgress?: (message: string) => void;
}): Promise<{ code: string }> {
  const url = new URL(params.redirectUri);
  const port = url.port ? Number(url.port) : 80;
  const hostname = url.hostname || "localhost";
  const expectedPath = url.pathname || "/";

  return new Promise<{ code: string }>((resolve, reject) => {
    let timeout: NodeJS.Timeout | null = null;
    const server = createServer((req, res) => {
      try {
        const requestUrl = new URL(req.url ?? "/", `http://${hostname}:${port}`);
        if (requestUrl.pathname !== expectedPath) {
          res.statusCode = 404;
          res.setHeader("Content-Type", "text/plain");
          res.end("Not found");
          return;
        }

        const error = requestUrl.searchParams.get("error");
        const code = requestUrl.searchParams.get("code")?.trim();
        if (error) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain");
          res.end(`Authentication failed: ${error}`);
          finish(new Error(`OAuth error: ${error}`));
          return;
        }
        if (!code) {
          res.statusCode = 400;
          res.setHeader("Content-Type", "text/plain");
          res.end("Missing code");
          finish(new Error("Missing OAuth code"));
          return;
        }

        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(
          "<!doctype html><html><head><meta charset='utf-8'/></head>" +
            "<body><h2>OpenRouter OAuth complete</h2>" +
            "<p>You can close this window and return to Moltbot.</p></body></html>",
        );

        finish(undefined, { code });
      } catch (err) {
        finish(err instanceof Error ? err : new Error("OAuth callback failed"));
      }
    });

    const finish = (err?: Error, result?: { code: string }) => {
      if (timeout) clearTimeout(timeout);
      try {
        server.close();
      } catch {
        // ignore close errors
      }
      if (err) {
        reject(err);
      } else if (result) {
        resolve(result);
      }
    };

    server.once("error", (err) => {
      finish(err instanceof Error ? err : new Error("OAuth callback server error"));
    });

    server.listen(port, hostname, () => {
      params.onProgress?.(`Waiting for OAuth callback on ${params.redirectUri}…`);
    });

    timeout = setTimeout(() => {
      finish(new Error("OAuth callback timeout"));
    }, params.timeoutMs);
  });
}

async function exchangeCodeForKey(params: {
  code: string;
  verifier: string;
}): Promise<OpenRouterOAuthResult> {
  const response = await fetch(OPENROUTER_KEYS_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      code: params.code,
      code_verifier: params.verifier,
      code_challenge_method: "S256",
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenRouter OAuth exchange failed: ${errorText}`);
  }

  const payload = (await response.json()) as {
    key?: string;
    key_id?: string;
    user_id?: string;
  };
  if (!payload.key) {
    throw new Error("OpenRouter OAuth response missing key.");
  }
  return {
    apiKey: payload.key,
    keyId: payload.key_id,
    userId: payload.user_id,
  };
}

export async function loginOpenRouterOAuth(
  ctx: OpenRouterOAuthContext,
): Promise<OpenRouterOAuthResult> {
  const redirectUri = process.env.OPENROUTER_OAUTH_REDIRECT_URI?.trim() || DEFAULT_REDIRECT_URI;
  const { verifier, challenge } = generatePkce();
  const authUrl = buildAuthUrl({ redirectUri, challenge });

  await ctx.note(
    ctx.isRemote
      ? [
          "You are running in a remote/VPS environment.",
          "Open the URL in your LOCAL browser.",
          "After signing in, paste the redirect URL back here.",
          "",
          `Redirect URI: ${redirectUri}`,
        ].join("\n")
      : [
          "Browser will open for OpenRouter authentication.",
          "If the callback doesn't auto-complete, paste the redirect URL.",
          "",
          `Redirect URI: ${redirectUri}`,
        ].join("\n"),
    "OpenRouter OAuth",
  );

  const needsManual = ctx.isRemote;
  if (!needsManual) {
    ctx.progress.update("Opening OpenRouter sign-in…");
    try {
      await ctx.openUrl(authUrl);
    } catch {
      ctx.log(`\nOpen this URL in your browser:\n\n${authUrl}\n`);
    }
  } else {
    ctx.log(`\nOpen this URL in your LOCAL browser:\n\n${authUrl}\n`);
  }

  let code = "";
  try {
    if (needsManual) {
      ctx.progress.update("Waiting for redirect URL…");
      const callbackInput = await ctx.prompt("Paste the redirect URL here: ");
      const parsed = parseCallbackInput(callbackInput);
      if ("error" in parsed) throw new Error(parsed.error);
      code = parsed.code;
    } else {
      const callback = await waitForLocalCallback({
        redirectUri,
        timeoutMs: 5 * 60 * 1000,
        onProgress: (msg) => ctx.progress.update(msg),
      });
      code = callback.code;
    }
  } catch (err) {
    if (
      err instanceof Error &&
      (err.message.includes("EADDRINUSE") ||
        err.message.toLowerCase().includes("port") ||
        err.message.toLowerCase().includes("listen"))
    ) {
      ctx.progress.update("Local callback server failed. Switching to manual mode...");
      ctx.log(`\nOpen this URL in your LOCAL browser:\n\n${authUrl}\n`);
      const callbackInput = await ctx.prompt("Paste the redirect URL here: ");
      const parsed = parseCallbackInput(callbackInput);
      if ("error" in parsed) throw new Error(parsed.error);
      code = parsed.code;
    } else {
      throw err;
    }
  }

  ctx.progress.update("Exchanging authorization code for key...");
  return await exchangeCodeForKey({ code, verifier });
}
