import { loadFromEnvIfSet } from "../util/config";

export const configChannels = {
  presenceTTL: await loadFromEnvIfSet("PRESENCE_TTL", 90),
  presenceHeartbeatInterval: await loadFromEnvIfSet(
    "PRESENCE_HEARTBEAT_INTERVAL",
    30,
  ),
};
