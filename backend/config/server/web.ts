import { loadFromEnvIfSet } from "../../util/config";

const port = await loadFromEnvIfSet("WEB_SERVER_PORT", 8080);
const host = await loadFromEnvIfSet("WEB_SERVER_HOST", "0.0.0.0");

export const configServerWeb = {
  enabled: await loadFromEnvIfSet("WEB_SERVER_ENABLED", true),
  port,
  host,
  applicationUrl: await loadFromEnvIfSet(
    "WEB_SERVER_APPLICATION_URL",
    `http://${host}:${port}`,
  ),
  apiRoute: await loadFromEnvIfSet("WEB_SERVER_API_ROUTE", "/api"),
};
