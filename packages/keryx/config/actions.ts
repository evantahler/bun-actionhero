import { loadFromEnvIfSet } from "../util/config";

export const configActions = {
  timeout: await loadFromEnvIfSet("ACTION_TIMEOUT", 300_000),
  fanOutBatchSize: await loadFromEnvIfSet("ACTION_FAN_OUT_BATCH_SIZE", 100),
  fanOutResultTtl: await loadFromEnvIfSet("ACTION_FAN_OUT_RESULT_TTL", 600),
};
