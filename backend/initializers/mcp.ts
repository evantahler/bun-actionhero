import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import colors from "colors";
import { randomUUID } from "crypto";
import { z } from "zod";
import * as z4mini from "zod/v4-mini";
import { api, logger } from "../api";
import type { Action } from "../classes/Action";
import { Connection } from "../classes/Connection";
import { Initializer } from "../classes/Initializer";
import { ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";
import pkg from "../package.json";
import type { PubSubMessage } from "./pubsub";

type McpHandleRequest = (req: Request) => Promise<Response>;

const namespace = "mcp";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<McpInitializer["initialize"]>>;
  }
}

/**
 * Convert an ActionHero action name to a valid MCP tool name.
 * MCP tool names only allow: A-Z, a-z, 0-9, underscore (_), dash (-), and dot (.)
 */
function formatToolName(actionName: string): string {
  return actionName.replace(/:/g, "-");
}

/**
 * Convert an MCP tool name back to the original ActionHero action name.
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

    async function getSessionAuth(
      mcpSessionId: string,
    ): Promise<string | null> {
      return api.redis.redis.get(`mcp:auth:${mcpSessionId}`);
    }

    async function setSessionAuth(
      mcpSessionId: string,
      connectionId: string,
    ): Promise<void> {
      await api.redis.redis.set(`mcp:auth:${mcpSessionId}`, connectionId);
      await api.redis.redis.expire(
        `mcp:auth:${mcpSessionId}`,
        config.session.ttl,
      );
    }

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
      getSessionAuth,
      setSessionAuth,
      formatToolName,
      parseToolName,
      sanitizeSchemaForMcp,
    };
  }

  async start() {
    if (!config.server.mcp.enabled) return;

    const mcpRoute = config.server.mcp.route;
    const authActionName = config.server.mcp.authenticationAction;

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

    // 2. Auth action validation
    let authAction: Action | undefined;
    if (authActionName) {
      authAction = api.actions.actions.find(
        (a: Action) => a.name === authActionName,
      );
      if (!authAction) {
        throw new TypedError({
          message: `MCP authentication action "${authActionName}" not found`,
          type: ErrorType.INITIALIZER_VALIDATION,
        });
      }
      if (!authAction.inputs) {
        throw new TypedError({
          message: `MCP authentication action "${authActionName}" must have an inputs schema`,
          type: ErrorType.INITIALIZER_VALIDATION,
        });
      }
    }

    // 3. Build handleRequest — each new session creates a fresh McpServer
    const transports = api.mcp.transports;
    const mcpServers = api.mcp.mcpServers;

    const corsHeaders: Record<string, string> = {
      "Access-Control-Allow-Origin": config.server.web.allowedOrigins,
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
      "Access-Control-Expose-Headers": "mcp-session-id",
    };

    api.mcp.handleRequest = async (req: Request): Promise<Response> => {
      const method = req.method.toUpperCase();

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

      const sessionId = req.headers.get("mcp-session-id");

      if (method === "POST" && !sessionId) {
        // New session — create a new McpServer + transport
        const mcpServer = createMcpServer(authActionName, authAction);
        mcpServers.push(mcpServer);

        const transport = new WebStandardStreamableHTTPServerTransport({
          sessionIdGenerator: () => randomUUID(),
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
          const response = await transport.handleRequest(req);
          return appendCorsHeaders(response, corsHeaders);
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
          const response = await transport.handleRequest(req);
          return appendCorsHeaders(response, corsHeaders);
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
 */
function createMcpServer(
  authActionName: string | null,
  authAction: Action | undefined,
): McpServer {
  const mcpServer = new McpServer(
    { name: pkg.name, version: pkg.version },
    { instructions: pkg.description },
  );

  for (const action of api.actions.actions) {
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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    mcpServer.registerTool(
      toolName,
      toolConfig,
      async (args: any, extra: any) => {
        const mcpSessionId =
          extra.sessionId ?? (extra._meta?.sessionId as string | undefined);

        // Determine connection ID (reuse authenticated session if available)
        let connectionId: string | undefined;
        if (mcpSessionId) {
          const existingConnectionId =
            await api.mcp.getSessionAuth(mcpSessionId);
          if (existingConnectionId) {
            connectionId = existingConnectionId;
          }
        }

        // Auth check via elicitation
        if (authActionName && !connectionId && mcpSessionId) {
          try {
            const elicitResult = await mcpServer.server.elicitInput({
              message: `Authentication required. Please provide credentials for ${authActionName}.`,
              requestedSchema: {
                type: "object" as const,
                properties: getElicitationProperties(authAction!),
              },
            });

            if (
              elicitResult.action === "accept" &&
              elicitResult.content &&
              typeof elicitResult.content === "object"
            ) {
              const authConnection = new Connection(
                "mcp",
                "mcp-client",
                randomUUID(),
              );
              try {
                const authParams = new FormData();
                for (const [key, value] of Object.entries(
                  elicitResult.content,
                )) {
                  if (value !== undefined && value !== null) {
                    authParams.set(key, String(value));
                  }
                }
                const { error } = await authConnection.act(
                  authActionName,
                  authParams,
                  "MCP",
                );
                if (error) {
                  authConnection.destroy();
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
                connectionId = authConnection.id;
                await api.mcp.setSessionAuth(mcpSessionId, connectionId);
              } catch (e) {
                authConnection.destroy();
                return {
                  content: [
                    {
                      type: "text" as const,
                      text: JSON.stringify({
                        error: `Authentication failed: ${e}`,
                      }),
                    },
                  ],
                  isError: true,
                };
              }
            } else {
              return {
                content: [
                  {
                    type: "text" as const,
                    text: JSON.stringify({
                      error: "Authentication declined by client",
                    }),
                  },
                ],
                isError: true,
              };
            }
          } catch (e) {
            // Elicitation not supported by client, skip auth
            logger.warn(
              `MCP elicitation failed for session ${mcpSessionId}: ${e}`,
            );
          }
        }

        const connection = new Connection(
          "mcp",
          "mcp-client",
          connectionId ?? randomUUID(),
        );

        try {
          // If we have an authenticated session, load it
          if (connectionId) {
            await connection.loadSession();
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
            "MCP",
          );

          // If this tool call newly established an authenticated session, persist the
          // mapping so subsequent tool calls within this MCP session reuse it
          if (
            !error &&
            !connectionId &&
            mcpSessionId &&
            connection.session?.data?.userId
          ) {
            await api.mcp.setSessionAuth(mcpSessionId, connection.id);
          }

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

function appendCorsHeaders(
  response: Response,
  corsHeaders: Record<string, string>,
): Response {
  const newHeaders = new Headers(response.headers);
  for (const [key, value] of Object.entries(corsHeaders)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  }
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
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

function getElicitationProperties(
  action: Action,
): Record<string, { type: "string"; description?: string }> {
  const properties: Record<string, { type: "string"; description?: string }> =
    {};
  const schema = action.inputs as any;
  if (schema?.shape) {
    for (const [key] of Object.entries(schema.shape)) {
      properties[key] = { type: "string" as const };
    }
  }
  return properties;
}
