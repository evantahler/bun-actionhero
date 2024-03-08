import { loadFromEnvIfSet } from "../util/config";

export const configProcess = {
  name: loadFromEnvIfSet("process.name", "server"),
  shutdownTimeout: loadFromEnvIfSet("process.shutdownTimeout", 1000 * 5),
};
