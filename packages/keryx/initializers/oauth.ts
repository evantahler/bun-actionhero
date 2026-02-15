import { randomUUID } from "crypto";
import Mustache from "mustache";
import { api } from "../index";
import type { OAuthActionResponse } from "../classes/Action";
import { Connection } from "../classes/Connection";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";
import { checkRateLimit } from "../middleware/rateLimit";
import {
  base64UrlEncode,
  escapeHtml,
  redirectUrisMatch,
  validateRedirectUri,
} from "../util/oauth";

const templatesDir = import.meta.dir + "/../templates";
let authTemplate: string;
let successTemplate: string;
let commonCss: string;
let lionSvg: string;

const namespace = "oauth";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<OAuthInitializer["initialize"]>>;
  }
}

type OAuthClient = {
  client_id: string;
  redirect_uris: string[];
  client_name?: string;
  grant_types?: string[];
  response_types?: string[];
  token_endpoint_auth_method?: string;
};

type AuthCode = {
  clientId: string;
  userId: number;
  codeChallenge: string;
  redirectUri: string;
};

type TokenData = {
  userId: number;
  clientId: string;
  scopes: string[];
};

export class OAuthInitializer extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 175;
    this.startPriority = 175;
  }

  async initialize() {
    authTemplate = await Bun.file(
      `${templatesDir}/oauth-authorize.html`,
    ).text();
    successTemplate = await Bun.file(
      `${templatesDir}/oauth-success.html`,
    ).text();
    commonCss = await Bun.file(`${templatesDir}/oauth-common.css`).text();
    lionSvg = await Bun.file(`${templatesDir}/lion.svg`).text();

    async function verifyAccessToken(token: string): Promise<TokenData | null> {
      const raw = await api.redis.redis.get(`oauth:token:${token}`);
      if (!raw) return null;
      return JSON.parse(raw) as TokenData;
    }

    async function handleRequest(
      req: Request,
      ip?: string,
    ): Promise<Response | null> {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method.toUpperCase();

      if (
        path.startsWith("/.well-known/oauth-protected-resource") &&
        method === "GET"
      ) {
        return handleProtectedResourceMetadata(url.origin);
      }
      if (
        path === "/.well-known/oauth-authorization-server" &&
        method === "GET"
      ) {
        return handleMetadata(url.origin);
      }

      // Rate-limit mutable OAuth endpoints by IP
      if (
        config.rateLimit.enabled &&
        ip &&
        (path === "/oauth/register" ||
          path === "/oauth/authorize" ||
          path === "/oauth/token")
      ) {
        // /oauth/register gets a stricter, dedicated rate limit
        const overrides =
          path === "/oauth/register"
            ? {
                limit: config.rateLimit.oauthRegisterLimit,
                windowMs: config.rateLimit.oauthRegisterWindowMs,
                keyPrefix: `${config.rateLimit.keyPrefix}:oauth-register`,
              }
            : undefined;
        const info = await checkRateLimit(`ip:${ip}`, false, overrides);
        if (info.retryAfter !== undefined) {
          return new Response(
            JSON.stringify({
              error: "rate_limit_exceeded",
              error_description: `Rate limit exceeded. Try again in ${info.retryAfter} seconds.`,
            }),
            {
              status: 429,
              headers: {
                "Content-Type": "application/json",
                "Retry-After": String(info.retryAfter),
                "X-RateLimit-Limit": String(info.limit),
                "X-RateLimit-Remaining": "0",
                "X-RateLimit-Reset": String(info.resetAt),
              },
            },
          );
        }
      }

      if (path === "/oauth/register" && method === "POST") {
        return handleRegister(req);
      }
      if (path === "/oauth/authorize" && method === "GET") {
        return handleAuthorizeGet(url);
      }
      if (path === "/oauth/authorize" && method === "POST") {
        return handleAuthorizePost(req);
      }
      if (path === "/oauth/token" && method === "POST") {
        return handleToken(req);
      }

      return null;
    }

    return {
      handleRequest,
      verifyAccessToken,
    };
  }
}

/**
 * RFC 9728 — Protected Resource Metadata.
 * MCP clients fetch this first to discover the authorization server.
 */
function handleProtectedResourceMetadata(origin: string): Response {
  return new Response(
    JSON.stringify({
      resource: origin,
      authorization_servers: [origin],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function handleMetadata(origin: string): Response {
  const issuer = origin;
  return new Response(
    JSON.stringify({
      issuer,
      authorization_endpoint: `${issuer}/oauth/authorize`,
      token_endpoint: `${issuer}/oauth/token`,
      registration_endpoint: `${issuer}/oauth/register`,
      response_types_supported: ["code"],
      grant_types_supported: ["authorization_code"],
      code_challenge_methods_supported: ["S256"],
      token_endpoint_auth_methods_supported: ["none"],
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

async function handleRegister(req: Request): Promise<Response> {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "Invalid JSON body",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  if (
    !body.redirect_uris ||
    !Array.isArray(body.redirect_uris) ||
    body.redirect_uris.length === 0
  ) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "redirect_uris is required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  for (const uri of body.redirect_uris) {
    if (typeof uri !== "string") {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: "Each redirect_uri must be a string",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    const validation = validateRedirectUri(uri);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({
          error: "invalid_request",
          error_description: validation.error,
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
  }

  const clientId = randomUUID();
  const client: OAuthClient = {
    client_id: clientId,
    redirect_uris: body.redirect_uris,
    client_name: body.client_name,
    grant_types: body.grant_types ?? ["authorization_code"],
    response_types: body.response_types ?? ["code"],
    token_endpoint_auth_method: body.token_endpoint_auth_method ?? "none",
  };

  await api.redis.redis.set(
    `oauth:client:${clientId}`,
    JSON.stringify(client),
    "EX",
    config.server.mcp.oauthClientTtl,
  );

  return new Response(JSON.stringify(client), {
    status: 201,
    headers: { "Content-Type": "application/json" },
  });
}

function handleAuthorizeGet(url: URL): Response {
  const clientId = url.searchParams.get("client_id") ?? "";
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const codeChallengeMethod =
    url.searchParams.get("code_challenge_method") ?? "";
  const responseType = url.searchParams.get("response_type") ?? "";
  const state = url.searchParams.get("state") ?? "";

  return renderAuthPage({
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    responseType,
    state,
    error: "",
  });
}

async function handleAuthorizePost(req: Request): Promise<Response> {
  let fields: Record<string, string>;
  try {
    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      const params = new URLSearchParams(text);
      fields = Object.fromEntries(params.entries());
    } else {
      const form = await req.formData();
      fields = {};
      form.forEach((value, key) => {
        fields[key] = String(value);
      });
    }
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const mode = fields.mode ?? "";
  const email = (fields.email ?? "").toLowerCase();
  const password = fields.password ?? "";
  const name = fields.name ?? "";
  const clientId = fields.client_id ?? "";
  const redirectUri = fields.redirect_uri ?? "";
  const codeChallenge = fields.code_challenge ?? "";
  const codeChallengeMethod = fields.code_challenge_method ?? "";
  const responseType = fields.response_type ?? "";
  const state = fields.state ?? "";

  const oauthParams = {
    clientId,
    redirectUri,
    codeChallenge,
    codeChallengeMethod,
    responseType,
    state,
    error: "",
  };

  // Validate client
  const clientRaw = await api.redis.redis.get(`oauth:client:${clientId}`);
  if (!clientRaw) {
    oauthParams.error = "Unknown client";
    return renderAuthPage(oauthParams);
  }
  const client = JSON.parse(clientRaw) as OAuthClient;

  const uriMatch = client.redirect_uris.some((registered) =>
    redirectUrisMatch(registered, redirectUri),
  );
  if (!uriMatch) {
    oauthParams.error = "Invalid redirect URI";
    return renderAuthPage(oauthParams);
  }

  if (codeChallengeMethod !== "S256") {
    oauthParams.error = "code_challenge_method must be S256";
    return renderAuthPage(oauthParams);
  }

  let userId: number;

  if (mode === "signup") {
    const signupAction = api.actions.actions.find((a) => a.mcp?.isSignupAction);
    const connection = new Connection("oauth", "oauth-signup");
    try {
      const params = new FormData();
      params.set("name", name);
      params.set("email", email);
      params.set("password", password);
      const { response, error } = await connection.act(
        signupAction!.name,
        params,
      );
      if (error) {
        oauthParams.error = error.message;
        return renderAuthPage(oauthParams);
      }
      userId = (response as OAuthActionResponse).user.id;
    } finally {
      connection.destroy();
    }
  } else {
    const loginAction = api.actions.actions.find((a) => a.mcp?.isLoginAction);
    const connection = new Connection("oauth", "oauth-login");
    try {
      const params = new FormData();
      params.set("email", email);
      params.set("password", password);
      const { response, error } = await connection.act(
        loginAction!.name,
        params,
      );
      if (error) {
        oauthParams.error = "Invalid email or password";
        return renderAuthPage(oauthParams);
      }
      userId = (response as OAuthActionResponse).user.id;
    } finally {
      connection.destroy();
    }
  }

  // Generate auth code
  const code = randomUUID();
  const codeData: AuthCode = {
    clientId,
    userId,
    codeChallenge,
    redirectUri,
  };

  await api.redis.redis.set(
    `oauth:code:${code}`,
    JSON.stringify(codeData),
    "EX",
    config.server.mcp.oauthCodeTtl,
  );

  const redirectUrl = new URL(redirectUri);
  redirectUrl.searchParams.set("code", code);
  if (state) redirectUrl.searchParams.set("state", state);

  return renderSuccessPage(redirectUrl.toString());
}

async function handleToken(req: Request): Promise<Response> {
  let body: URLSearchParams;
  const contentType = req.headers.get("content-type") ?? "";

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const text = await req.text();
    body = new URLSearchParams(text);
  } else if (contentType.includes("application/json")) {
    const json = await req.json();
    body = new URLSearchParams(json as Record<string, string>);
  } else {
    // Try form-urlencoded as default
    const text = await req.text();
    body = new URLSearchParams(text);
  }

  const grantType = body.get("grant_type");
  const code = body.get("code");
  const codeVerifier = body.get("code_verifier");
  const redirectUri = body.get("redirect_uri");
  const clientId = body.get("client_id");

  if (grantType !== "authorization_code") {
    return new Response(JSON.stringify({ error: "unsupported_grant_type" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!code || !codeVerifier) {
    return new Response(
      JSON.stringify({
        error: "invalid_request",
        error_description: "code and code_verifier are required",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Look up auth code
  const codeRaw = await api.redis.redis.get(`oauth:code:${code}`);
  if (!codeRaw) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "Invalid or expired authorization code",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  const codeData = JSON.parse(codeRaw) as AuthCode;

  // Delete the code immediately (single use)
  await api.redis.redis.del(`oauth:code:${code}`);

  // Validate client_id matches
  if (clientId && clientId !== codeData.clientId) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "client_id mismatch",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Validate redirect_uri matches
  if (redirectUri && redirectUri !== codeData.redirectUri) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "redirect_uri mismatch",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Verify PKCE: BASE64URL(SHA256(code_verifier)) === stored code_challenge
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(codeVerifier),
  );
  const computedChallenge = base64UrlEncode(new Uint8Array(digest));

  if (computedChallenge !== codeData.codeChallenge) {
    return new Response(
      JSON.stringify({
        error: "invalid_grant",
        error_description: "PKCE verification failed",
      }),
      { status: 400, headers: { "Content-Type": "application/json" } },
    );
  }

  // Generate access token
  const accessToken = randomUUID();
  const tokenData: TokenData = {
    userId: codeData.userId,
    clientId: codeData.clientId,
    scopes: [],
  };

  await api.redis.redis.set(
    `oauth:token:${accessToken}`,
    JSON.stringify(tokenData),
    "EX",
    config.session.ttl,
  );

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: config.session.ttl,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

type AuthPageParams = {
  clientId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod: string;
  responseType: string;
  state: string;
  error: string;
};

function renderAuthPage(params: AuthPageParams): Response {
  const errorHtml = params.error
    ? `<div class="error">${escapeHtml(params.error)}</div>`
    : "";

  const hiddenFields = `
    <input type="hidden" name="client_id" value="${escapeHtml(params.clientId)}">
    <input type="hidden" name="redirect_uri" value="${escapeHtml(params.redirectUri)}">
    <input type="hidden" name="code_challenge" value="${escapeHtml(params.codeChallenge)}">
    <input type="hidden" name="code_challenge_method" value="${escapeHtml(params.codeChallengeMethod)}">
    <input type="hidden" name="response_type" value="${escapeHtml(params.responseType)}">
    <input type="hidden" name="state" value="${escapeHtml(params.state)}">
  `;

  const html = Mustache.render(
    authTemplate,
    { errorHtml, hiddenFields },
    { commonCss, lionSvg },
  );

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function renderSuccessPage(redirectUrl: string): Response {
  const html = Mustache.render(
    successTemplate,
    { redirectUrl },
    { commonCss, lionSvg },
  );

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
