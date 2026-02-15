import { api } from "keryx";

await api.initialize();
await api.db.generateMigrations();
await api.stop();
