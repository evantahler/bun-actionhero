import { $ } from "bun";
import { DefaultLogger, type LogWriter, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/bun-sql";
import { migrate } from "drizzle-orm/bun-sql/migrator";
import fs from "node:fs";
import { unlink } from "node:fs/promises";
import path from "path";
import { SQL } from "bun";
import { api, logger } from "../api";
import { Initializer } from "../classes/Initializer";
import { ErrorType, TypedError } from "../classes/TypedError";
import { config } from "../config";
import { formatConnectionStringForLogging } from "../util/connectionString";

const namespace = "db";

declare module "../classes/API" {
  export interface API {
    [namespace]: Awaited<ReturnType<DB["initialize"]>>;
  }
}

export class DB extends Initializer {
  constructor() {
    super(namespace);
    this.loadPriority = 100;
    this.startPriority = 100;
    this.stopPriority = 910;
  }

  async initialize() {
    const dbContainer = {} as {
      db: ReturnType<typeof drizzle>;
      client: InstanceType<typeof SQL>;
    };
    return Object.assign(
      {
        generateMigrations: this.generateMigrations,
        clearDatabase: this.clearDatabase,
      },
      dbContainer,
    );
  }

  async start() {
    api.db.client = new SQL(config.database.connectionString);

    class DrizzleLogger implements LogWriter {
      write(message: string) {
        logger.debug(message);
      }
    }

    api.db.db = drizzle({
      client: api.db.client,
      logger: new DefaultLogger({ writer: new DrizzleLogger() }),
    });

    try {
      await api.db.db.execute(sql`SELECT NOW()`);
    } catch (e) {
      throw new TypedError({
        type: ErrorType.SERVER_INITIALIZATION,
        message: `Cannot connect to database (${formatConnectionStringForLogging(config.database.connectionString)}): ${e}`,
      });
    }

    if (config.database.autoMigrate) {
      try {
        const migrationsFolder = path.join(api.rootDir, "drizzle");
        const journalPath = path.join(
          migrationsFolder,
          "meta",
          "_journal.json",
        );
        if (!fs.existsSync(journalPath)) {
          fs.mkdirSync(path.dirname(journalPath), { recursive: true });
          fs.writeFileSync(journalPath, JSON.stringify({ entries: [] }));
          logger.info("created empty drizzle migrations journal");
        }
        // Pass object with migrationsFolder property
        // `migrate()` from drizzle-orm/bun-sql/migrator expects an object with migrationsFolder property,
        // not just a string path, therefore: { migrationsFolder: migrationsFolder }
        await migrate(api.db.db, { migrationsFolder });
        logger.info("database migrated successfully");
      } catch (e) {
        throw new TypedError({
          type: ErrorType.SERVER_INITIALIZATION,
          message: `Cannot migrate database (${formatConnectionStringForLogging(config.database.connectionString)}): ${e}`,
        });
      }
    }

    logger.info(
      `database connection established (${formatConnectionStringForLogging(config.database.connectionString)})`,
    );
  }

  async stop() {
    if (api.db.db && api.db.client) {
      try {
        await api.db.client.close();
        logger.info("database connection closed");
      } catch (e) {
        logger.error("error closing database connection", e);
      }
    }
  }

  /**
   * Generate migrations for the database schema.
   */
  async generateMigrations() {
    // Use `defineConfig` from `drizzle-kit` instead of the `Config` type
    // - the `url` property isn't recognized in the `DrizzleMigrateConfig` type
    // - a different approach is needed for Bun
    const migrationConfig = {
      dialect: "postgresql" as const,
      schema: path.join(api.rootDir, "schema", "*"),
      driver: "bun" as const, // ✅ Specify Bun driver
      dbCredentials: {
        url: config.database.connectionString,
      },
      out: path.join(api.rootDir, "drizzle"),
    };

    const fileContent = `export default ${JSON.stringify(migrationConfig, null, 2)}`;
    const tmpfilePath = path.join(api.rootDir, "drizzle", "config.tmp.ts");

    try {
      await Bun.write(tmpfilePath, fileContent);
      const { exitCode, stdout, stderr } =
        await $`bun drizzle-kit generate --config ${tmpfilePath}`;
      logger.trace(stdout.toString());
      if (exitCode !== 0) {
        {
          throw new TypedError({
            message: `Failed to generate migrations: ${stderr.toString()}`,
            type: ErrorType.SERVER_INITIALIZATION,
          });
        }
      }
    } finally {
      const filePointer = Bun.file(tmpfilePath);
      if (await filePointer.exists()) await unlink(tmpfilePath);
    }
  }

  /**
   * Erase all the tables in the active database.
   */
  async clearDatabase(restartIdentity = true, cascade = true) {
    if (Bun.env.NODE_ENV === "production") {
      throw new TypedError({
        message: "clearDatabase cannot be called in production",
        type: ErrorType.SERVER_INITIALIZATION,
      });
    }

    const result = await api.db.db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = CURRENT_SCHEMA`,
    );

    for (const row of result) {
      logger.debug(`truncating table ${row.tablename}`);
      await api.db.db.execute(
        sql.raw(
          `TRUNCATE TABLE "${row.tablename}" ${restartIdentity ? "RESTART IDENTITY" : ""} ${cascade ? "CASCADE" : ""} `,
        ),
      );
    }
  }
}