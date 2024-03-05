import { loadFromEnvIfSet } from "../util/config";

export const configName = {
  name: loadFromEnvIfSet<string>("name", "server"),
};
