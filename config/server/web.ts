import { loadFromEnvIfSet } from "../../util/config";

export const configServerWeb = {
  port: await loadFromEnvIfSet("servers.web.port", 8080, true),
  host: await loadFromEnvIfSet("servers.web.host", "0.0.0.0"),
  apiRoute: await loadFromEnvIfSet("servers.web.apiRoute", "/api"),
  assetRoute: await loadFromEnvIfSet("servers.web.assetRouter", "/assets"),
  pageRoute: await loadFromEnvIfSet("servers.web.pageRoute", "/pages"),
};
