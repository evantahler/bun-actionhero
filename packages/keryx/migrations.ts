import { api } from "./index";

await api.initialize();
await api.db.generateMigrations();
await api.stop();
