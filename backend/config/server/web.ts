import { loadFromEnvIfSet } from "../../util/config";

const port = await loadFromEnvIfSet("WEB_SERVER_PORT", 8080);
const host = await loadFromEnvIfSet("WEB_SERVER_HOST", "localhost");

export const configServerWeb = {
  enabled: await loadFromEnvIfSet("WEB_SERVER_ENABLED", true),
  port,
  host,
  applicationUrl: await loadFromEnvIfSet(
    "APPLICATION_URL",
    `http://${host}:${port}`,
  ),
  apiRoute: await loadFromEnvIfSet("WEB_SERVER_API_ROUTE", "/api"),
  allowedOrigins: await loadFromEnvIfSet("WEB_SERVER_ALLOWED_ORIGINS", "*"),
  allowedMethods: await loadFromEnvIfSet(
    "WEB_SERVER_ALLOWED_METHODS",
    "HEAD, GET, POST, PUT, PATCH, DELETE, OPTIONS",
  ),
  allowedHeaders: await loadFromEnvIfSet(
    "WEB_SERVER_ALLOWED_HEADERS",
    "Content-Type",
  ),
  staticFilesEnabled: await loadFromEnvIfSet("WEB_SERVER_STATIC_ENABLED", true),
  staticFilesDirectory: await loadFromEnvIfSet(
    "WEB_SERVER_STATIC_DIRECTORY",
    "assets",
  ),
  staticFilesRoute: await loadFromEnvIfSet("WEB_SERVER_STATIC_ROUTE", "/"),
};
