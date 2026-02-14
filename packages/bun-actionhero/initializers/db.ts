import { $ } from "bun";
import { type Config as DrizzleMigrateConfig } from "drizzle-kit";
import { DefaultLogger, type LogWriter, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { unlink } from "node:fs/promises";
import path from "path";
import { Pool } from "pg";
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
      pool: Pool;
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
    api.db.pool = new Pool({
      connectionString: config.database.connectionString,
    });

    class DrizzleLogger implements LogWriter {
      write(message: string) {
        logger.debug(message);
      }
    }

    api.db.db = drizzle(api.db.pool, {
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
        await migrate(api.db.db, { migrationsFolder: "./drizzle" });
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
    if (api.db.db && api.db.pool) {
      try {
        await api.db.pool.end();
        logger.info("database connection closed");
      } catch (e) {
        logger.error("error closing database connection", e);
      }
    }
  }

  /**
   * Generate migrations for the database schema.
   * Learn more @ https://orm.drizzle.team/kit-docs/overview
   */
  async generateMigrations() {
    const migrationConfig = {
      schema: path.join("models", "*"),
      dbCredentials: {
        uri: config.database.connectionString,
      },
      out: path.join("drizzle"),
    } satisfies DrizzleMigrateConfig;

    const fileContent = `export default ${JSON.stringify(migrationConfig, null, 2)}`;
    const tmpfilePath = path.join(api.rootDir, "drizzle", "config.tmp.ts");

    try {
      await Bun.write(tmpfilePath, fileContent);
      const { exitCode, stdout, stderr } =
        await $`bun drizzle-kit generate:pg --config ${tmpfilePath}`;
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
   * Erase all the tables in the active database.  Will fail on production environments.
   */
  async clearDatabase(restartIdentity = true, cascade = true) {
    if (Bun.env.NODE_ENV === "production") {
      throw new TypedError({
        message: "clearDatabase cannot be called in production",
        type: ErrorType.SERVER_INITIALIZATION,
      });
    }

    const { rows } = await api.db.db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = CURRENT_SCHEMA`,
    );

    for (const row of rows) {
      logger.debug(`truncating table ${row.tablename}`);
      await api.db.db.execute(
        sql.raw(
          `TRUNCATE TABLE "${row.tablename}" ${restartIdentity ? "RESTART IDENTITY" : ""} ${cascade ? "CASCADE" : ""} `,
        ),
      );
    }
  }
}
