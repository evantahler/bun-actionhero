import { eq } from "drizzle-orm";
import { createSchemaFactory } from "drizzle-zod";
import { z } from "zod";
import { api } from "../api";
import { ErrorType, TypedError } from "../classes/TypedError";
import { messages, type Message } from "../schema/messages";
import { users, type User } from "../schema/users";

// Zod v4: Extend GlobalMeta to support custom 'isSecret' metadata
// This allows using .meta({ isSecret: true }) on any zod schema
declare module "zod" {
  interface GlobalMeta {
    isSecret?: boolean;
  }
}

/**
 * Helper function to mark a zod schema as secret.
 * Uses Zod v4's native .meta() API.
 * @example
 * const passwordSchema = secret(z.string());
 */
export function secret<T extends z.ZodType>(schema: T): T {
  return schema.meta({ isSecret: true }) as T;
}

/**
 * Check if a zod schema is marked as secret.
 * @example
 * if (isSecret(schema)) { ... }
 */
export function isSecret(schema: z.ZodType): boolean {
  return schema.meta()?.isSecret === true;
}

/**
 * Creates a Zod schema that accepts both boolean and string values,
 * transforming string representations of booleans to actual booleans.
 * Useful for handling form data where booleans come as strings.
 */
export function zBooleanFromString() {
  return z.union([z.boolean(), z.string()]).transform((val) => {
    if (typeof val === "boolean") return val;
    if (typeof val === "string") {
      if (val.toLowerCase() === "true") return true;
      if (val.toLowerCase() === "false") return false;
    }
    return false;
  });
}

// Create schema factory with Zod v4 instance for drizzle-zod compatibility
const { createSelectSchema } = createSchemaFactory({ zodInstance: z });

// Type for Drizzle tables with an id column
type TableWithId = { id: any; $inferSelect: any };

/**
 * Generic factory to create a Zod schema that accepts either an ID or a model object.
 * If an ID is provided, it resolves to the full model via database lookup.
 *
 * @param table - Drizzle table definition (must have an `id` column)
 * @param modelSchema - Zod schema for the model (from createSelectSchema)
 * @param isModel - Type guard function to check if value is already a model
 * @param entityName - Human-readable name for error messages
 */
function zIdOrModel<TTable extends TableWithId, TModel>(
  table: TTable,
  modelSchema: z.ZodType<TModel>,
  isModel: (val: unknown) => val is TModel,
  entityName: string,
) {
  return z
    .union([z.coerce.number().int().positive(), modelSchema])
    .transform(async (val): Promise<TModel> => {
      if (isModel(val)) {
        return val;
      }
      const [record] = await api.db.db
        .select()
        .from(table as any)
        .where(eq((table as any).id, val))
        .limit(1);

      if (!record) {
        throw new TypedError({
          message: `${entityName} with id ${val} not found`,
          type: ErrorType.CONNECTION_ACTION_RUN,
        });
      }
      return record as TModel;
    })
    .describe(`A ${entityName} ID or ${entityName} object`);
}

/**
 * Zod schema generated from Drizzle users table.
 * Automatically stays in sync with the database schema.
 */
export const zUserSchema = createSelectSchema(users);

/**
 * Type guard to check if a value is a valid User object.
 */
export function isUser(val: unknown): val is User {
  return zUserSchema.safeParse(val).success;
}

/**
 * Accepts either a user_id (string/number) or a User object.
 * Resolves to a full User via async transform if ID is provided.
 */
export function zUserIdOrModel() {
  return zIdOrModel(users, zUserSchema as z.ZodType<User>, isUser, "User");
}

/**
 * Zod schema generated from Drizzle messages table.
 * Automatically stays in sync with the database schema.
 */
export const zMessageSchema = createSelectSchema(messages);

/**
 * Type guard to check if a value is a valid Message object.
 */
export function isMessage(val: unknown): val is Message {
  return zMessageSchema.safeParse(val).success;
}

/**
 * Accepts either a message_id (string/number) or a Message object.
 * Resolves to a full Message via async transform if ID is provided.
 */
export function zMessageIdOrModel() {
  return zIdOrModel(
    messages,
    zMessageSchema as z.ZodType<Message>,
    isMessage,
    "Message",
  );
}
