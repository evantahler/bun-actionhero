import { loadFromEnvIfSet } from "../util/config";

export const configProcess = {
  name: await loadFromEnvIfSet("BUN_PROCESS_NAME", "server"),
  shutdownTimeout: await loadFromEnvIfSet(
    "BUN_PROCESS_SHUTDOWN_TIMEOUT",
    1000 * 5,
  ),
};
