import { eq } from "drizzle-orm";
import { z, type ZodRawShape, type ZodTypeAny } from "zod";
import { api } from "../api";
import { ErrorType, TypedError } from "../classes/TypedError";
import { messages, type Message } from "../schema/messages";
import { users, type User } from "../schema/users";

// Custom zod extension to mark fields as secret
// This module augmentation and prototype extension allows .secret() to be used on zod fields

declare module "zod" {
  interface ZodString {
    secret(): ZodString;
  }
  interface ZodNumber {
    secret(): ZodNumber;
  }
  interface ZodBoolean {
    secret(): ZodBoolean;
  }
  interface ZodArray<T extends ZodTypeAny> {
    secret(): ZodArray<T>;
  }
  interface ZodObject<T extends ZodRawShape> {
    secret(): ZodObject<T>;
  }
  interface ZodOptional<T extends ZodTypeAny> {
    secret(): ZodOptional<T>;
  }
  interface ZodNullable<T extends ZodTypeAny> {
    secret(): ZodNullable<T>;
  }
  interface ZodDefault<T extends ZodTypeAny> {
    secret(): ZodDefault<T>;
  }
}

z.ZodString.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};
z.ZodNumber.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};
z.ZodBoolean.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};
z.ZodArray.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};
z.ZodObject.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};
z.ZodOptional.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};
z.ZodNullable.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};
z.ZodDefault.prototype.secret = function () {
  (this._def as any).isSecret = true;
  return this;
};

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

/**
 * Zod schema that matches the User type from Drizzle.
 */
export const zUserSchema = z.object({
  id: z.number().int(),
  name: z.string(),
  email: z.string(),
  password_hash: z.string(),
  createdAt: z.date(),
  updatedAt: z.date(),
}) satisfies z.ZodType<User>;

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
  return z
    .union([z.coerce.number().int().positive(), zUserSchema])
    .transform(async (val): Promise<User> => {
      if (isUser(val)) {
        return val;
      }
      const [user] = await api.db.db
        .select()
        .from(users)
        .where(eq(users.id, val))
        .limit(1);

      if (!user) {
        throw new TypedError({
          message: `User with id ${val} not found`,
          type: ErrorType.CONNECTION_ACTION_RUN,
        });
      }
      return user;
    })
    .describe("A User ID or User object");
}

/**
 * Zod schema that matches the Message type from Drizzle.
 */
export const zMessageSchema = z.object({
  id: z.number().int(),
  body: z.string(),
  user_id: z.number().int(),
  createdAt: z.date(),
  updatedAt: z.date(),
}) satisfies z.ZodType<Message>;

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
  return z
    .union([z.coerce.number().int().positive(), zMessageSchema])
    .transform(async (val): Promise<Message> => {
      if (isMessage(val)) {
        return val;
      }
      const [message] = await api.db.db
        .select()
        .from(messages)
        .where(eq(messages.id, val))
        .limit(1);

      if (!message) {
        throw new TypedError({
          message: `Message with id ${val} not found`,
          type: ErrorType.CONNECTION_ACTION_RUN,
        });
      }
      return message;
    })
    .describe("A Message ID or Message object");
}
