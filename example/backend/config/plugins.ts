import { observabilityPlugin } from "@keryxjs/observability";
import type { KeryxPlugin } from "keryx";

export default {
  plugins: [observabilityPlugin] as KeryxPlugin[],
};
