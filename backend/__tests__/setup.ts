import { setMaxListeners } from "events";

// Set max listeners to prevent warnings in CI environments
// TODO: Github Actions needs this, but not locally. Why?
setMaxListeners(999);
