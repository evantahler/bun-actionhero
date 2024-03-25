import { api } from "./api";

await api.initialize();
await api.drizzle.generateMigrations();
await api.stop();
