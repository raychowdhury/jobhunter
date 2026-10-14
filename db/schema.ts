import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";
export const profiles = sqliteTable("profiles", {
  userId: text("user_id").primaryKey(), data: text("data").notNull(), updatedAt: integer("updated_at").notNull(),
});
export const applications = sqliteTable("applications", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), jobKey: text("job_key").notNull(),
  data: text("data").notNull(), createdAt: integer("created_at").notNull(), updatedAt: integer("updated_at").notNull(),
}, (table) => [uniqueIndex("applications_user_job").on(table.userId, table.jobKey)]);
export const stories = sqliteTable("stories", {
  id: text("id").primaryKey(), userId: text("user_id").notNull(), data: text("data").notNull(), updatedAt: integer("updated_at").notNull(),
});
export const boardCache = sqliteTable("board_cache", {
  board: text("board").primaryKey(), data: text("data").notNull(), fetchedAt: integer("fetched_at").notNull(),
});
