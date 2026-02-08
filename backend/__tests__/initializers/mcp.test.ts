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
  beforeAll(async () => {
    config.server.mcp.enabled = true;
    await api.start();
  }, HOOK_TIMEOUT);

  afterAll(async () => {
    await api.stop();
    config.server.mcp.enabled = false;
  }, HOOK_TIMEOUT);

  test("MCP server boots when enabled", () => {
    expect(api.mcp.mcpServers).toBeDefined();
    expect(api.mcp.handleRequest).toBeFunction();
  });

  test("POST initialize returns 200 with session ID", async () => {
    const initRequest = {
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    };

    const res = await fetch(mcpUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
      },
      body: JSON.stringify(initRequest),
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

  test("GET without session ID returns 400", async () => {
    const res = await fetch(mcpUrl(), { method: "GET" });
    expect(res.status).toBe(400);
  });

  test("POST with invalid session ID returns 404", async () => {
    const res = await fetch(mcpUrl(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
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

  describe("with MCP client", () => {
    let client: Client;
    let transport: StreamableHTTPClientTransport;

    beforeAll(async () => {
      transport = new StreamableHTTPClientTransport(new URL(mcpUrl()));
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

    test("tools/list returns all actions as tools", async () => {
      const result = await client.listTools();
      expect(result.tools.length).toBeGreaterThan(0);

      const toolNames = result.tools.map((t) => t.name);
      expect(toolNames).toContain("status");

      // All registered actions should be tools (with formatted names)
      for (const action of api.actions.actions) {
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
      // user:create requires email, password, etc. — tool name is "user-create"
      const result = await client.callTool({
        name: "user-create",
        arguments: {},
      });
      expect(result.isError).toBe(true);

      const content = result.content as Array<{ type: string }>;
      expect(content).toBeArray();
      expect(content.length).toBeGreaterThan(0);
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

  test("Redis auth helpers work", async () => {
    const testSessionId = "test-mcp-session-123";
    const testConnectionId = "test-connection-456";

    // Initially no auth
    const before = await api.mcp.getSessionAuth(testSessionId);
    expect(before).toBeNull();

    // Set auth
    await api.mcp.setSessionAuth(testSessionId, testConnectionId);

    // Retrieve auth
    const after = await api.mcp.getSessionAuth(testSessionId);
    expect(after).toBe(testConnectionId);

    // Cleanup
    await api.redis.redis.del(`mcp:auth:${testSessionId}`);
  });
});
