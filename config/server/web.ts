import { loadFromEnvIfSet } from "../../util/config";

const port = await loadFromEnvIfSet("BUN_SERVERS_WEB_PORT", 8080);
const host = await loadFromEnvIfSet("BUN_SERVERS_WEB_HOST", "0.0.0.0");

export const configServerWeb = {
  enabled: await loadFromEnvIfSet("BUN_SERVERS_WEB_ENABLED", true),
  port,
  host,
  applicationUrl: await loadFromEnvIfSet(
    "BUN_SERVERS_WEB_APPLICATION_URL",
    `http://${host}:${port}`,
  ),
  apiRoute: await loadFromEnvIfSet("BUN_SERVERS_WEB_API_ROUTE", "/api"),
};
