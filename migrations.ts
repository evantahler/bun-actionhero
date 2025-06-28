import { api } from "./api";

await api.initialize();
await api.db.generateMigrations();
await api.stop();
