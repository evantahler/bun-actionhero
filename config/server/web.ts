import { loadFromEnvIfSet } from "../../util/config";

export const configServerWeb = {
  port: loadFromEnvIfSet("servers.web.port", 8080),
  host: loadFromEnvIfSet("servers.web.host", "0.0.0.0"),
};
