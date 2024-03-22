import {
  pgTable,
  serial,
  uniqueIndex,
  varchar,
  timestamp,
  text,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: serial("id").primaryKey(),
    name: varchar("name", { length: 256 }),
    email: text("email"),
    password_hash: text("password_hash"),
    createdAt: timestamp("created_at"),
    updatedAt: timestamp("updated_at"),
  },
  (users) => {
    return {
      nameIndex: uniqueIndex("name_idx").on(users.name),
      emailIndex: uniqueIndex("email_idx").on(users.email),
    };
  },
);
