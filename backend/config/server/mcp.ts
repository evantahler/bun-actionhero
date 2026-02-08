import { loadFromEnvIfSet } from "../../util/config";

export const configServerMcp = {
  enabled: await loadFromEnvIfSet("MCP_SERVER_ENABLED", false),
  route: await loadFromEnvIfSet("MCP_SERVER_ROUTE", "/mcp"),
  authenticationAction: await loadFromEnvIfSet(
    "MCP_SERVER_AUTHENTICATION_ACTION",
    null as string | null,
  ),
};
