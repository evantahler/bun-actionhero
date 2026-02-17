-- Batch-refresh TTL on presence keys:
--   KEYS = list of presence keys to refresh
--   ARGV[1] = TTL in seconds

for i = 1, #KEYS do
  redis.call('EXPIRE', KEYS[i], ARGV[1])
end
return #KEYS
