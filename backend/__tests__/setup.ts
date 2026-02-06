import { setDefaultTimeout } from "bun:test";
import { setMaxListeners } from "events";

// Set max listeners to prevent warnings in CI environments
// TODO: Github Actions needs this, but not locally. Why?
setMaxListeners(999);

// CI environments are slower; ensure hooks (beforeAll/afterAll) have enough
// time for api.start()/api.stop() which connect to Redis, Postgres, etc.
setDefaultTimeout(15_000);
