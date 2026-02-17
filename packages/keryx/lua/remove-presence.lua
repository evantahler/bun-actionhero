-- Atomic removePresence:
--   KEYS[1] = connectionSetKey (presence:{channel}:{key})
--   KEYS[2] = channelKey       (presence:{channel})
--   ARGV[1] = connectionId
--   ARGV[2] = presenceKey
-- Returns 1 if the presence key was fully removed (leave), 0 otherwise.

local removed = redis.call('SREM', KEYS[1], ARGV[1])
if removed == 0 then return 0 end
local remaining = redis.call('SCARD', KEYS[1])
if remaining == 0 then
  redis.call('DEL', KEYS[1])
  redis.call('SREM', KEYS[2], ARGV[2])
  return 1
end
return 0
