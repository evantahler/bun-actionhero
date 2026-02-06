import { setMaxListeners } from "events";

// Set max listeners to prevent warnings in CI environments
// TODO: Github Actions needs this, but not locally. Why?
setMaxListeners(999);

// CI environments are slower; hooks need enough time for api.start()/api.stop()
// which connect to Redis, Postgres, run migrations, etc.
// bun:test's setDefaultTimeout and bunfig.toml [test].timeout only apply to
// test() blocks, not lifecycle hooks — so we export this for explicit use.
export const HOOK_TIMEOUT = 15_000;
