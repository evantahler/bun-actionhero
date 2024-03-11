import { loadFromEnvIfSet } from "../util/config";

export const configProcess = {
  name: await loadFromEnvIfSet("process.name", "server", true),
  shutdownTimeout: await loadFromEnvIfSet("process.shutdownTimeout", 1000 * 5),
};
