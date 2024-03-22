import { pgTable, serial, text, integer, timestamp } from "drizzle-orm/pg-core";
import { users } from "./users";

export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  body: text("body"),
  user_id: integer("user_id").references(() => users.id),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});
