import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { z } from "zod";
import * as z4mini from "zod/v4-mini";
import { api } from "../../api";
import { config } from "../../config";
import { HOOK_TIMEOUT } from "../setup";

const mcpUrl = () =>
  `${config.server.web.applicationUrl}${config.server.mcp.route}`;
const baseUrl = () => config.server.web.applicationUrl;

/**
 * Helper: run the full OAuth flow and return a Bearer access token.
 * Creates a new user via signup each time.
 */
async function getAccessToken(): Promise<string> {
  const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `mcp-test-${unique}@example.com`;
  const name = `MCP Test ${unique}`;
  const password = "password123!";
  const redirectUri = "http://localhost:9999/callback";

  // Register OAuth client
  const regRes = await fetch(`${baseUrl()}/oauth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      redirect_uris: [redirectUri],
      client_name: "Test Helper Client",
    }),
  });
  const { client_id: clientId } = (await regRes.json()) as {
    client_id: string;
  };

  // PKCE
  const codeVerifier = randomString(43);
  const codeChallenge = await computeS256Challenge(codeVerifier);

  // Signup + get auth code
  const authRes = await fetch(`${baseUrl()}/oauth/authorize`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      mode: "signup",
      name,
      email,
      password,
      client_id: clientId,
      redirect_uri: redirectUri,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      response_type: "code",
      state: "helper",
    }).toString(),
    redirect: "manual",
  });
  const authHtml = await authRes.text();
  const metaMatch = authHtml.match(
    /<meta name="redirect-url" content="([^"]+)"\s*\/?>/,
  );
  const code = new URL(metaMatch![1]).searchParams.get("code")!;

  // Exchange code for token
  const tokenRes = await fetch(`${baseUrl()}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      code_verifier: codeVerifier,
      client_id: clientId,
      redirect_uri: redirectUri,
    }).toString(),
  });
  const { access_token } = (await tokenRes.json()) as {
    access_token: string;
  };
  return access_token;
}

describe("mcp initializer (disabled)", () => {
  beforeAll(async () => {
    config.server.mcp.enabled = false;
    await api.start();
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    await api.stop();
  }, HOOK_TIMEOUT);

  test("MCP is disabled by default", () => {
    expect(config.server.mcp.enabled).toBe(false);
  });

  test("/mcp returns 404 when disabled", async () => {
    const res = await fetch(mcpUrl(), { method: "POST" });
    expect(res.status).toBe(404);
  });
});

describe("mcp initializer (enabled)", () => {
  let accessToken: string;

  beforeAll(async () => {
    config.server.mcp.enabled = true;
    await api.start();
    accessToken = await getAccessToken();
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    await api.stop();
    config.server.mcp.enabled = false;
  }, HOOK_TIMEOUT);

  test("MCP server boots when enabled", () => {
    expect(api.mcp.mcpServers).toBeDefined();
    expect(api.mcp.handleRequest).toBeFunction();
  });

  test("POST without auth returns 401 with WWW-Authenticate header", async () => {
    const res = await fetch(mcpUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(401);
    expect(res.headers.get("www-authenticate")).toBe("Bearer");
  });

  test("POST initialize with auth returns 200 with session ID", async () => {
    const res = await fetch(mcpUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-03-26",
          capabilities: {},
          clientInfo: { name: "test-client", version: "1.0.0" },
        },
      }),
    });
    expect(res.status).toBe(200);
    const sessionId = res.headers.get("mcp-session-id");
    expect(sessionId).toBeTruthy();
  });

  test("OPTIONS returns 204 with CORS headers", async () => {
    const res = await fetch(mcpUrl(), { method: "OPTIONS" });
    expect(res.status).toBe(204);
    expect(res.headers.get("access-control-allow-methods")).toBeTruthy();
    expect(res.headers.get("access-control-allow-headers")).toContain(
      "mcp-session-id",
    );
  });

  test("GET without auth returns 401", async () => {
    const res = await fetch(mcpUrl(), { method: "GET" });
    expect(res.status).toBe(401);
  });

  test("GET with auth but no session ID returns 400", async () => {
    const res = await fetch(mcpUrl(), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    expect(res.status).toBe(400);
  });

  test("POST with auth but invalid session ID returns 404", async () => {
    const res = await fetch(mcpUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        Authorization: `Bearer ${accessToken}`,
        "mcp-session-id": "nonexistent-session-id",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "tools/list",
        params: {},
      }),
    });
    expect(res.status).toBe(404);
  });

  test("tool name formatting", () => {
    expect(api.mcp.formatToolName("status")).toBe("status");
    expect(api.mcp.formatToolName("user:create")).toBe("user-create");
    expect(api.mcp.formatToolName("messages:list")).toBe("messages-list");
    expect(api.mcp.parseToolName("user-create")).toBe("user:create");
    expect(api.mcp.parseToolName("status")).toBe("status");
  });

  describe("with authenticated MCP client", () => {
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeAll(async () => {
      transport = new StreamableHTTPClientTransport(new URL(mcpUrl()), {
        requestInit: {
          headers: { Authorization: `Bearer ${accessToken}` },
        },
      });
      client = new Client({ name: "test-client", version: "1.0.0" });
      await client.connect(transport);
    });

    afterAll(async () => {
      try {
        await transport.close();
      } catch {
        // ignore close errors
      }
    });

    test("tools/list returns actions as tools (excluding mcp=false)", async () => {
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);

      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("status");

      // Actions with mcp=false should NOT be listed
      expect(toolNames).not.toContain("session-create");
      expect(toolNames).not.toContain("user-create");

      // All registered actions with mcp !== false should be tools
      for (const action of api.actions.actions) {
        if (action.mcp === false) continue;
        expect(toolNames).toContain(api.mcp.formatToolName(action.name));
      }
    });

    test("tool invocation (status) returns valid response", async () => {
      const result = await client.callTool({
        name: "status",
        arguments: {},
      });
      expect(result.isError).toBeFalsy();

      const content = result.content as Array<{
        type: string;
        text?: string;
      }>;
      expect(content).toBeArray();
      expect(content.length).toBeGreaterThan(0);

      const textContent = content[0];
      expect(textContent.type).toBe("text");
      const parsed = JSON.parse(textContent.text!);
      expect(parsed).toHaveProperty("name");
      expect(parsed).toHaveProperty("version");
      expect(parsed).toHaveProperty("uptime");
    });

    test("tool invocation with missing required param returns isError", async () => {
      // user:edit requires authentication (SessionMiddleware) — tool name is "user-edit"
      const result = await client.callTool({
        name: "user-edit",
        arguments: {},
      });
      expect(result.isError).toBe(true);

      const content = result.content as Array<{ type: string }>;
      expect(content).toBeArray();
      expect(content.length).toBeGreaterThan(0);
    });
  });

  describe("OAuth endpoints", () => {
    test("protected resource metadata returns authorization server", async () => {
      const res = await fetch(
        `${baseUrl()}/.well-known/oauth-protected-resource`,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.resource).toBe(baseUrl());
      expect(body.authorization_servers).toEqual([baseUrl()]);
    });

    test("OAuth metadata endpoint returns valid JSON", async () => {
      const res = await fetch(
        `${baseUrl()}/.well-known/oauth-authorization-server`,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.issuer).toBe(baseUrl());
      expect(body.authorization_endpoint).toContain("/oauth/authorize");
      expect(body.token_endpoint).toContain("/oauth/token");
      expect(body.registration_endpoint).toContain("/oauth/register");
      expect(body.response_types_supported).toContain("code");
      expect(body.code_challenge_methods_supported).toContain("S256");
    });

    test("OAuth client registration works", async () => {
      const res = await fetch(`${baseUrl()}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: ["http://localhost:3000/callback"],
          client_name: "Test Client",
        }),
      });
      expect(res.status).toBe(201);
      const body = (await res.json()) as Record<string, unknown>;
      expect(body.client_id).toBeTruthy();
      expect(body.redirect_uris).toEqual(["http://localhost:3000/callback"]);
      expect(body.client_name).toBe("Test Client");
    });

    test("OAuth client registration requires redirect_uris", async () => {
      const res = await fetch(`${baseUrl()}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ client_name: "Bad Client" }),
      });
      expect(res.status).toBe(400);
    });

    test("OAuth authorize GET returns HTML page", async () => {
      const res = await fetch(
        `${baseUrl()}/oauth/authorize?client_id=test&redirect_uri=http://localhost:3000/callback&code_challenge=abc&code_challenge_method=S256&response_type=code&state=xyz`,
      );
      expect(res.status).toBe(200);
      expect(res.headers.get("content-type")).toContain("text/html");
      const html = await res.text();
      expect(html).toContain("Sign In");
      expect(html).toContain("Sign Up");
    });

    test("full OAuth flow: register → authorize → token → authenticated tool call", async () => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const email = `oauth-test-${unique}@example.com`;
      const name = `OAuth Test ${unique}`;
      const password = "password123!";
      const redirectUri = "http://localhost:9999/callback";

      // 1. Register client
      const regRes = await fetch(`${baseUrl()}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: [redirectUri],
          client_name: "OAuth Test Client",
        }),
      });
      expect(regRes.status).toBe(201);
      const { client_id: clientId } = (await regRes.json()) as {
        client_id: string;
      };

      // 2. Generate PKCE challenge
      const codeVerifier = randomString(43);
      const codeChallenge = await computeS256Challenge(codeVerifier);

      // 3. POST to authorize (signup mode) — should redirect with code
      const authForm = new URLSearchParams({
        mode: "signup",
        name,
        email,
        password,
        client_id: clientId,
        redirect_uri: redirectUri,
        code_challenge: codeChallenge,
        code_challenge_method: "S256",
        response_type: "code",
        state: "test-state",
      });

      const authRes = await fetch(`${baseUrl()}/oauth/authorize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: authForm.toString(),
        redirect: "manual",
      });
      expect(authRes.status).toBe(200);
      const authHtml = await authRes.text();
      const metaMatch = authHtml.match(
        /<meta name="redirect-url" content="([^"]+)"\s*\/?>/,
      );
      expect(metaMatch).toBeTruthy();
      const redirectUrl = new URL(metaMatch![1]);
      const code = redirectUrl.searchParams.get("code");
      expect(code).toBeTruthy();
      expect(redirectUrl.searchParams.get("state")).toBe("test-state");

      // 4. Exchange code for token
      const tokenRes = await fetch(`${baseUrl()}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: code!,
          code_verifier: codeVerifier,
          client_id: clientId,
          redirect_uri: redirectUri,
        }).toString(),
      });
      expect(tokenRes.status).toBe(200);
      const tokenBody = (await tokenRes.json()) as {
        access_token: string;
        token_type: string;
        expires_in: number;
      };
      expect(tokenBody.access_token).toBeTruthy();
      expect(tokenBody.token_type).toBe("Bearer");
      expect(tokenBody.expires_in).toBeGreaterThan(0);

      // 5. Use the Bearer token with MCP to call an authenticated tool
      const authTransport = new StreamableHTTPClientTransport(
        new URL(mcpUrl()),
        {
          requestInit: {
            headers: {
              Authorization: `Bearer ${tokenBody.access_token}`,
            },
          },
        },
      );
      const authClient = new Client({
        name: "oauth-test-client",
        version: "1.0.0",
      });
      await authClient.connect(authTransport);

      try {
        // Call message-create which requires auth (SessionMiddleware)
        const msgResult = await authClient.callTool({
          name: "message-create",
          arguments: { body: "Hello from OAuth" },
        });
        expect(msgResult.isError).toBeFalsy();
        const content = msgResult.content as Array<{
          type: string;
          text?: string;
        }>;
        const parsed = JSON.parse(content[0].text!);
        expect(parsed).toHaveProperty("message");
        expect(parsed.message.body).toBe("Hello from OAuth");
      } finally {
        try {
          await authTransport.close();
        } catch {
          // ignore
        }
      }
    });

    test("end-to-end: create user, sign in, post message", async () => {
      const unique = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const email = `e2e-${unique}@example.com`;
      const name = `E2E User ${unique}`;
      const password = "testpassword99!";
      const redirectUri = "http://localhost:9999/callback";

      // --- Register an OAuth client ---
      const regRes = await fetch(`${baseUrl()}/oauth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          redirect_uris: [redirectUri],
          client_name: "E2E Test Client",
        }),
      });
      expect(regRes.status).toBe(201);
      const { client_id: clientId } = (await regRes.json()) as {
        client_id: string;
      };

      // --- 1. Create user via OAuth signup ---
      const signupVerifier = randomString(43);
      const signupChallenge = await computeS256Challenge(signupVerifier);

      const signupRes = await fetch(`${baseUrl()}/oauth/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          mode: "signup",
          name,
          email,
          password,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: signupChallenge,
          code_challenge_method: "S256",
          response_type: "code",
          state: "signup",
        }).toString(),
        redirect: "manual",
      });
      expect(signupRes.status).toBe(200);
      // We don't exchange this code — the user is now created in the DB

      // --- 2. Sign in as the created user via OAuth signin ---
      const signinVerifier = randomString(43);
      const signinChallenge = await computeS256Challenge(signinVerifier);

      const signinRes = await fetch(`${baseUrl()}/oauth/authorize`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          mode: "signin",
          email,
          password,
          client_id: clientId,
          redirect_uri: redirectUri,
          code_challenge: signinChallenge,
          code_challenge_method: "S256",
          response_type: "code",
          state: "signin",
        }).toString(),
        redirect: "manual",
      });
      expect(signinRes.status).toBe(200);

      const signinHtml = await signinRes.text();
      const signinMetaMatch = signinHtml.match(
        /<meta name="redirect-url" content="([^"]+)"\s*\/?>/,
      );
      expect(signinMetaMatch).toBeTruthy();
      const signinRedirect = new URL(signinMetaMatch![1]);
      const signinCode = signinRedirect.searchParams.get("code");
      expect(signinCode).toBeTruthy();
      expect(signinRedirect.searchParams.get("state")).toBe("signin");

      // --- Exchange signin code for access token ---
      const tokenRes = await fetch(`${baseUrl()}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          code: signinCode!,
          code_verifier: signinVerifier,
          client_id: clientId,
          redirect_uri: redirectUri,
        }).toString(),
      });
      expect(tokenRes.status).toBe(200);
      const { access_token: e2eAccessToken } = (await tokenRes.json()) as {
        access_token: string;
      };
      expect(e2eAccessToken).toBeTruthy();

      // --- 3. Post a message via authenticated MCP tool call ---
      const authTransport = new StreamableHTTPClientTransport(
        new URL(mcpUrl()),
        {
          requestInit: {
            headers: { Authorization: `Bearer ${e2eAccessToken}` },
          },
        },
      );
      const authClient = new Client({
        name: "e2e-test-client",
        version: "1.0.0",
      });
      await authClient.connect(authTransport);

      try {
        const msgResult = await authClient.callTool({
          name: "message-create",
          arguments: { body: "Hello from E2E test" },
        });
        expect(msgResult.isError).toBeFalsy();

        const content = msgResult.content as Array<{
          type: string;
          text?: string;
        }>;
        const parsed = JSON.parse(content[0].text!);
        expect(parsed).toHaveProperty("message");
        expect(parsed.message.body).toBe("Hello from E2E test");
        expect(parsed.message.user_id).toBeGreaterThan(0);

        // Verify the message is retrievable via messages-list
        const listResult = await authClient.callTool({
          name: "messages-list",
          arguments: { limit: "5" },
        });
        expect(listResult.isError).toBeFalsy();

        const listContent = listResult.content as Array<{
          type: string;
          text?: string;
        }>;
        const listParsed = JSON.parse(listContent[0].text!);
        expect(listParsed.messages).toBeArray();
        const ourMessage = listParsed.messages.find(
          (m: any) => m.body === "Hello from E2E test",
        );
        expect(ourMessage).toBeTruthy();
        expect(ourMessage.user_name).toBe(name);
      } finally {
        try {
          await authTransport.close();
        } catch {
          // ignore
        }
      }
    });

    test("unauthenticated MCP connection returns 401", async () => {
      const transport = new StreamableHTTPClientTransport(new URL(mcpUrl()));
      const client = new Client({
        name: "noauth-test-client",
        version: "1.0.0",
      });

      try {
        await client.connect(transport);
        // If connect doesn't throw, the SDK may have handled the 401 differently
        // In that case, fail the test
        expect(true).toBe(false);
      } catch (e) {
        // Expected: the MCP SDK throws when the server returns 401
        expect(String(e)).toContain("Authentication required");
      } finally {
        try {
          await transport.close();
        } catch {
          // ignore
        }
      }
    });
  });

  describe("schema sanitization", () => {
    test("simple schemas pass through unchanged", () => {
      const schema = z.object({ name: z.string(), age: z.number() });
      const sanitized = api.mcp.sanitizeSchemaForMcp(schema);
      expect(sanitized).toBe(schema); // same reference = no sanitization needed
    });

    test("schemas with Date fields get sanitized", () => {
      const schema = z.object({
        name: z.string(),
        createdAt: z.date(),
      });
      const sanitized = api.mcp.sanitizeSchemaForMcp(schema);
      expect(sanitized).not.toBe(schema); // different reference = was sanitized

      // Should not throw when converting to JSON Schema
      const jsonSchema = z4mini.toJSONSchema(sanitized, {
        target: "draft-7",
        io: "input",
      });
      expect(jsonSchema).toHaveProperty("properties");
      expect((jsonSchema as any).properties.name.type).toBe("string");
      expect((jsonSchema as any).properties.createdAt.type).toBe("string");
    });

    test("schemas with union types containing Date get sanitized", () => {
      const schema = z.object({
        user: z.union([
          z.coerce.number(),
          z.object({ id: z.number(), createdAt: z.date() }),
        ]),
      });
      const sanitized = api.mcp.sanitizeSchemaForMcp(schema);
      const jsonSchema = z4mini.toJSONSchema(sanitized, {
        target: "draft-7",
        io: "input",
      });
      expect(jsonSchema).toHaveProperty("properties");
    });

    test("non-object schemas pass through", () => {
      expect(api.mcp.sanitizeSchemaForMcp(null)).toBeNull();
      expect(api.mcp.sanitizeSchemaForMcp(undefined)).toBeUndefined();
      expect(api.mcp.sanitizeSchemaForMcp("not-a-schema")).toBe("not-a-schema");
    });
  });

  test("notification forwarding is set up", () => {
    expect(typeof api.mcp.sendNotification).toBe("function");
  });
});

// --- Helper functions ---

function randomString(length: number): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~";
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function computeS256Challenge(verifier: string): Promise<string> {
  const encoder = new TextEncoder();
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(verifier),
  );
  const bytes = new Uint8Array(digest);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
