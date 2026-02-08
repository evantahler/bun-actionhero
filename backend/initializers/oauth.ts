import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { api } from "../api";
import { Initializer } from "../classes/Initializer";
import { config } from "../config";
import { checkPassword, hashPassword } from "../ops/UserOps";
import { users } from "../schema/users";

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
    async function verifyAccessToken(token: string): Promise<TokenData | null> {
      const raw = await api.redis.redis.get(`oauth:token:${token}`);
      if (!raw) return null;
      return JSON.parse(raw) as TokenData;
    }

    async function handleRequest(req: Request): Promise<Response | null> {
      const url = new URL(req.url);
      const path = url.pathname;
      const method = req.method.toUpperCase();

      if (
        path === "/.well-known/oauth-authorization-server" &&
        method === "GET"
      ) {
        return handleMetadata();
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

function handleMetadata(): Response {
  const issuer = config.server.web.applicationUrl;
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

  if (!client.redirect_uris.includes(redirectUri)) {
    oauthParams.error = "Invalid redirect URI";
    return renderAuthPage(oauthParams);
  }

  if (codeChallengeMethod !== "S256") {
    oauthParams.error = "code_challenge_method must be S256";
    return renderAuthPage(oauthParams);
  }

  let userId: number;

  if (mode === "signup") {
    if (!name || name.length < 3) {
      oauthParams.error = "Name must be at least 3 characters";
      return renderAuthPage(oauthParams);
    }
    if (!email || !email.includes("@") || !email.includes(".")) {
      oauthParams.error = "Invalid email address";
      return renderAuthPage(oauthParams);
    }
    if (!password || password.length < 8) {
      oauthParams.error = "Password must be at least 8 characters";
      return renderAuthPage(oauthParams);
    }

    const [existingUser] = await api.db.db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (existingUser) {
      oauthParams.error = "User already exists";
      return renderAuthPage(oauthParams);
    }

    const [newUser] = await api.db.db
      .insert(users)
      .values({
        name,
        email,
        password_hash: await hashPassword(password),
      })
      .returning();

    userId = newUser.id;
  } else {
    // Sign in
    if (!email || !password) {
      oauthParams.error = "Email and password are required";
      return renderAuthPage(oauthParams);
    }

    const [user] = await api.db.db
      .select()
      .from(users)
      .where(eq(users.email, email));

    if (!user) {
      oauthParams.error = "Invalid email or password";
      return renderAuthPage(oauthParams);
    }

    const passwordMatch = await checkPassword(user, password);
    if (!passwordMatch) {
      oauthParams.error = "Invalid email or password";
      return renderAuthPage(oauthParams);
    }

    userId = user.id;
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

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl.toString() },
  });
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

  const tokenTtl = Math.floor(config.session.ttl / 1000); // config.session.ttl is in ms
  await api.redis.redis.set(
    `oauth:token:${accessToken}`,
    JSON.stringify(tokenData),
    "EX",
    tokenTtl,
  );

  return new Response(
    JSON.stringify({
      access_token: accessToken,
      token_type: "Bearer",
      expires_in: tokenTtl,
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    },
  );
}

function base64UrlEncode(buffer: Uint8Array): string {
  let binary = "";
  for (const byte of buffer) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
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

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Authorize Application</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; background: #f5f5f5; display: flex; justify-content: center; align-items: center; min-height: 100vh; }
    .container { background: #fff; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); padding: 32px; width: 100%; max-width: 400px; }
    h2 { margin-bottom: 20px; color: #333; }
    .error { background: #fee; border: 1px solid #fcc; color: #c00; padding: 10px; border-radius: 4px; margin-bottom: 16px; }
    .tabs { display: flex; margin-bottom: 20px; border-bottom: 2px solid #eee; }
    .tab { flex: 1; padding: 10px; text-align: center; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; color: #666; }
    .tab.active { border-bottom-color: #0066cc; color: #0066cc; font-weight: 600; }
    .form-section { display: none; }
    .form-section.active { display: block; }
    label { display: block; margin-bottom: 4px; font-weight: 500; color: #555; font-size: 14px; }
    input[type="text"], input[type="email"], input[type="password"] { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; font-size: 14px; margin-bottom: 12px; }
    input:focus { outline: none; border-color: #0066cc; box-shadow: 0 0 0 2px rgba(0,102,204,0.2); }
    button { width: 100%; padding: 12px; background: #0066cc; color: #fff; border: none; border-radius: 4px; font-size: 16px; cursor: pointer; }
    button:hover { background: #0052a3; }
  </style>
</head>
<body>
  <div class="container">
    <h2>Authorize Application</h2>
    ${errorHtml}
    <div class="tabs">
      <div class="tab active" onclick="switchTab('signin')">Sign In</div>
      <div class="tab" onclick="switchTab('signup')">Sign Up</div>
    </div>
    <div id="signin-form" class="form-section active">
      <form method="POST" action="/oauth/authorize">
        ${hiddenFields}
        <input type="hidden" name="mode" value="signin">
        <label for="signin-email">Email</label>
        <input type="email" id="signin-email" name="email" required>
        <label for="signin-password">Password</label>
        <input type="password" id="signin-password" name="password" required>
        <button type="submit">Sign In</button>
      </form>
    </div>
    <div id="signup-form" class="form-section">
      <form method="POST" action="/oauth/authorize">
        ${hiddenFields}
        <input type="hidden" name="mode" value="signup">
        <label for="signup-name">Name</label>
        <input type="text" id="signup-name" name="name" required minlength="3">
        <label for="signup-email">Email</label>
        <input type="email" id="signup-email" name="email" required>
        <label for="signup-password">Password</label>
        <input type="password" id="signup-password" name="password" required minlength="8">
        <button type="submit">Sign Up</button>
      </form>
    </div>
  </div>
  <script>
    function switchTab(tab) {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.form-section').forEach(f => f.classList.remove('active'));
      document.querySelector('#' + tab + '-form').classList.add('active');
      event.target.classList.add('active');
    }
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
