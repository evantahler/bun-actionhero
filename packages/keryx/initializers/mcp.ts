import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import colors from "colors";
import { randomUUID } from "crypto";
import { z } from "zod";
import * as z4mini from "zod/v4-mini";
import { api, logger } from "../api";
import { Connection } from "../classes/Connection";
import { Initializer } from "../classes/Initializer";
import { ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";
import pkg from "../package.json";
import {
  appendHeaders,
  buildCorsHeaders,
  getExternalOrigin,
} from "../util/http";
import type { PubSubMessage } from "./pubsub";

type McpHandleRequest = (req: Request, ip: string) => Promise<Response>;

const namespace = "mcp";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<McpInitializer["initialize"]>>;
  }
}

/**
 * Convert a Keryx action name to a valid MCP tool name.
 * MCP tool names only allow: A-Z, a-z, 0-9, underscore (_), dash (-), and dot (.)
 */
function formatToolName(actionName: string): string {
  return actionName.replace(/:/g, "-");
}

/**
 * Convert an MCP tool name back to the original Keryx action name.
 */
function parseToolName(toolName: string): string {
  // Reverse lookup against registered actions
  const action = api.actions.actions.find(
    (a) => formatToolName(a.name) === toolName,
  );
  return action ? action.name : toolName;
}

export class McpInitializer extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 200;
    this.startPriority = 560;
    this.stopPriority = 90;
  }

  async initialize() {
    const mcpServers: McpServer[] = [];
    const transports = new Map<
      string,
      WebStandardStreamableHTTPServerTransport
    >();

    function sendNotification(payload: PubSubMessage) {
      for (const server of mcpServers) {
        try {
          server.server
            .sendLoggingMessage({
              level: "info",
              data: {
                channel: payload.channel,
                message: payload.message,
                sender: payload.sender,
              },
            })
            .catch(() => {
              // transport may be closed
            });
        } catch {
          // transport may be closed
        }
      }
    }

    return {
      mcpServers,
      transports,
      handleRequest: null as McpHandleRequest | null,
      sendNotification,
      formatToolName,
      parseToolName,
      sanitizeSchemaForMcp,
    };
  }

  async start() {
    if (!config.server.mcp.enabled) return;

    const mcpRoute = config.server.mcp.route;

    // 1. Route validation
    if (!mcpRoute.startsWith("/")) {
      throw new TypedError({
        message: `MCP route must start with "/", got: ${mcpRoute}`,
        type: ErrorType.INITIALIZER_VALIDATION,
      });
    }

    const apiRoute = config.server.web.apiRoute;
    if (mcpRoute.startsWith(apiRoute + "/") || mcpRoute === apiRoute) {
      throw new TypedError({
        message: `MCP route "${mcpRoute}" must not be under the API route "${apiRoute}"`,
        type: ErrorType.INITIALIZER_VALIDATION,
      });
    }

    for (const action of api.actions.actions) {
      if (action.web?.route) {
        const fullRoute = apiRoute + action.web.route;
        if (fullRoute === mcpRoute) {
          throw new TypedError({
            message: `MCP route "${mcpRoute}" conflicts with action "${action.name}" route "${fullRoute}"`,
            type: ErrorType.INITIALIZER_VALIDATION,
          });
        }
      }
    }

    // 2. Build handleRequest — each new session creates a fresh McpServer
    const transports = api.mcp.transports;
    const mcpServers = api.mcp.mcpServers;

    api.mcp.handleRequest = async (
      req: Request,
      ip: string,
    ): Promise<Response> => {
      const method = req.method.toUpperCase();
      const requestOrigin = req.headers.get("origin") ?? undefined;
      const corsHeaders = buildCorsHeaders(requestOrigin, {
        "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
        "Access-Control-Allow-Headers":
          "Content-Type, mcp-session-id, Authorization",
        "Access-Control-Expose-Headers": "mcp-session-id",
      });

      // Reject requests from unrecognized origins when APPLICATION_URL is set
      if (requestOrigin) {
        const appUrl = config.server.web.applicationUrl;
        if (appUrl && !appUrl.startsWith("http://localhost")) {
          const allowedOrigin = new URL(appUrl).origin;
          if (requestOrigin !== allowedOrigin) {
            return new Response(
              JSON.stringify({ error: "Origin not allowed" }),
              {
                status: 403,
                headers: {
                  "Content-Type": "application/json",
                  ...corsHeaders,
                },
              },
            );
          }
        }
      }

      // Handle OPTIONS for CORS preflight
      if (method === "OPTIONS") {
        return new Response(null, { status: 204, headers: corsHeaders });
      }

      if (method !== "GET" && method !== "POST" && method !== "DELETE") {
        return new Response(null, {
          status: 405,
          headers: corsHeaders,
        });
      }

      // Extract and verify Bearer token for auth
      let authInfo:
        | {
            token: string;
            clientId: string;
            scopes: string[];
            extra?: Record<string, unknown>;
          }
        | undefined;
      const authHeader = req.headers.get("authorization");
      if (authHeader?.startsWith("Bearer ")) {
        const token = authHeader.slice(7);
        const tokenData = await api.oauth.verifyAccessToken(token);
        if (tokenData) {
          authInfo = {
            token,
            clientId: tokenData.clientId,
            scopes: tokenData.scopes ?? [],
            extra: { userId: tokenData.userId, ip },
          };
        }
      }

      // Require authentication — return 401 so MCP clients initiate the OAuth flow
      if (!authInfo) {
        const origin = getExternalOrigin(req, new URL(req.url));
        const resourceMetadataUrl = `${origin}/.well-known/oauth-protected-resource${config.server.mcp.route}`;
        return new Response(
          JSON.stringify({ error: "Authentication required" }),
          {
            status: 401,
            headers: {
              "Content-Type": "application/json",
              "WWW-Authenticate": `Bearer resource_metadata="${resourceMetadataUrl}"`,
              ...corsHeaders,
            },
          },
        );
      }

      const sessionId = req.headers.get("mcp-session-id");

      if (method === "POST" && !sessionId) {
        // New session — create a new McpServer + transport
        const mcpServer = createMcpServer();
        mcpServers.push(mcpServer);

        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
          enableJsonResponse: true,
          onsessioninitialized: (sid) => {
            transports.set(sid, transport);
          },
          onsessionclosed: (sid) => {
            transports.delete(sid);
            const idx = mcpServers.indexOf(mcpServer);
            if (idx !== -1) mcpServers.splice(idx, 1);
          },
        });

        transport.onclose = () => {
          const sid = transport.sessionId;
          if (sid) {
            transports.delete(sid);
          }
          const idx = mcpServers.indexOf(mcpServer);
          if (idx !== -1) mcpServers.splice(idx, 1);
        };

        await mcpServer.connect(transport);

        try {
          const response = await transport.handleRequest(req, { authInfo });
          return appendHeaders(response, corsHeaders);
        } catch (e) {
          logger.error(`MCP transport error: ${e}`);
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal server error" },
              id: null,
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
        }
      }

      if (sessionId) {
        const transport = transports.get(sessionId);
        if (!transport) {
          return new Response(JSON.stringify({ error: "Session not found" }), {
            status: 404,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders,
            },
          });
        }

        try {
          const response = await transport.handleRequest(req, { authInfo });
          return appendHeaders(response, corsHeaders);
        } catch (e) {
          logger.error(`MCP transport error: ${e}`);
          return new Response(
            JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32603, message: "Internal server error" },
              id: null,
            }),
            {
              status: 500,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders,
              },
            },
          );
        }
      }

      // GET/DELETE without session ID
      return new Response(
        JSON.stringify({ error: "Mcp-Session-Id header required" }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders,
          },
        },
      );
    };

    const mcpUrl = `${config.server.web.applicationUrl}${mcpRoute}`;
    const startMessage = `started MCP server @ ${mcpUrl}`;
    logger.info(logger.colorize ? colors.bgBlue(startMessage) : startMessage);
  }

  async stop() {
    if (!config.server.mcp.enabled) return;

    // Close all transports
    for (const transport of api.mcp.transports.values()) {
      try {
        await transport.close();
      } catch {
        // ignore errors during shutdown
      }
    }
    api.mcp.transports.clear();

    // Close all MCP servers
    for (const server of api.mcp.mcpServers) {
      try {
        await server.close();
      } catch {
        // ignore errors during shutdown
      }
    }
    api.mcp.mcpServers.length = 0;

    api.mcp.handleRequest = null;
  }
}

/**
 * Create a new McpServer instance with all actions registered as tools.
 * Each MCP session gets its own McpServer (the SDK requires 1:1 mapping).
 * Actions with `mcp === false` are excluded from tool registration.
 */
function createMcpServer(): McpServer {
  const mcpServer = new McpServer(
    { name: pkg.name, version: pkg.version },
    { instructions: pkg.description },
  );

  for (const action of api.actions.actions) {
    if (!action.mcp?.enabled) continue;

    const toolName = formatToolName(action.name);
    const toolConfig: {
      description?: string;
      inputSchema?: any;
    } = {};

    if (action.description) {
      toolConfig.description = action.description;
    }

    if (action.inputs) {
      toolConfig.inputSchema = sanitizeSchemaForMcp(action.inputs);
    }

    mcpServer.registerTool(
      toolName,
      toolConfig,
      async (args: any, extra: any) => {
        const authInfo = extra.authInfo;

        const clientIp = (authInfo?.extra?.ip as string) || "unknown";
        const mcpSessionId = extra.sessionId || "";
        const connection = new Connection("mcp", clientIp, randomUUID());
        if (config.server.web.requestId.header) {
          connection.requestId = randomUUID();
        }

        try {
          // If Bearer token was verified, set up authenticated session
          if (authInfo?.extra?.userId) {
            await connection.loadSession();
            await connection.updateSession({ userId: authInfo.extra.userId });
          }

          const params = new FormData();
          if (args && typeof args === "object") {
            for (const [key, value] of Object.entries(
              args as Record<string, unknown>,
            )) {
              if (Array.isArray(value)) {
                for (const item of value) {
                  params.append(key, String(item));
                }
              } else if (value !== undefined && value !== null) {
                params.set(key, String(value));
              }
            }
          }

          const { response, error } = await connection.act(
            action.name,
            params,
            "",
            mcpSessionId,
          );

          if (error) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: JSON.stringify({
                    error: error.message,
                    type: error.type,
                  }),
                },
              ],
              isError: true,
            };
          }

          return {
            content: [
              { type: "text" as const, text: JSON.stringify(response) },
            ],
          };
        } finally {
          connection.destroy();
        }
      },
    );
  }

  return mcpServer;
}

/**
 * Sanitize a Zod object schema for MCP tool registration.
 * The MCP SDK's internal JSON Schema converter (zod/v4-mini toJSONSchema)
 * cannot handle certain Zod types like z.date(). This function tests each
 * field individually and replaces incompatible fields with z.string().
 */
function sanitizeSchemaForMcp(schema: any): any {
  if (!schema || typeof schema !== "object" || !("shape" in schema)) {
    return schema;
  }

  const newShape: Record<string, any> = {};
  let needsSanitization = false;

  for (const [key, fieldSchema] of Object.entries(
    schema.shape as Record<string, any>,
  )) {
    try {
      z4mini.toJSONSchema(z.object({ [key]: fieldSchema }), {
        target: "draft-7",
        io: "input",
      });
      newShape[key] = fieldSchema;
    } catch {
      needsSanitization = true;
      newShape[key] = z.string().describe(`${key}`);
    }
  }

  return needsSanitization ? z.object(newShape) : schema;
}
