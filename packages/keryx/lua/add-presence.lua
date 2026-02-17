-- Atomic addPresence:
--   KEYS[1] = connectionSetKey (presence:{channel}:{key})
--   KEYS[2] = channelKey       (presence:{channel})
--   ARGV[1] = connectionId
--   ARGV[2] = presenceKey
--   ARGV[3] = TTL in seconds
-- Returns 1 if the presence key was newly added (join), 0 otherwise.

redis.call('SADD', KEYS[1], ARGV[1])
redis.call('EXPIRE', KEYS[1], ARGV[3])
local added = redis.call('SADD', KEYS[2], ARGV[2])
redis.call('EXPIRE', KEYS[2], ARGV[3])
return added
