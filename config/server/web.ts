import { loadFromEnvIfSet } from "../../util/config";

export const configServerWeb = {
  enabled: await loadFromEnvIfSet("BUN_SERVERS_WEB_ENABLED", true),
  port: await loadFromEnvIfSet("BUN_SERVERS_WEB_PORT", 8080),
  host: await loadFromEnvIfSet("BUN_SERVERS_WEB_HOST", "0.0.0.0"),
  apiRoute: await loadFromEnvIfSet("BUN_SERVERS_WEB_API_ROUTE", "/api"),
};
