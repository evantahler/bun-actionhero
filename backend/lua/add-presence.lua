-- Atomic addPresence:
--   KEYS[1] = connectionSetKey (presence:{channel}:{key})
--   KEYS[2] = channelKey       (presence:{channel})
--   ARGV[1] = connectionId
--   ARGV[2] = presenceKey
-- Returns 1 if the presence key was newly added (join), 0 otherwise.

redis.call('SADD', KEYS[1], ARGV[1])
return redis.call('SADD', KEYS[2], ARGV[2])
