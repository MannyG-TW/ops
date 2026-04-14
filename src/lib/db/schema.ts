import { sqliteTable, text, integer, uniqueIndex } from "drizzle-orm/sqlite-core";

/* ─── Internal Notes ─── */
export const internalNotes = sqliteTable("internal_notes", {
  id: text("id").primaryKey(), // UUIDv4
  customerId: text("customer_id").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  body: text("body").notNull(),
  mentions: text("mentions").notNull().default("[]"), // JSON string[]
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export type InsertNote = typeof internalNotes.$inferInsert;
export type SelectNote = typeof internalNotes.$inferSelect;

/* ─── Notifications ─── */
export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(), // UUIDv4
  userId: text("user_id").notNull(), // recipient
  type: text("type").notNull(), // "mention" | "escalation" | "task_assignment" | "system"
  title: text("title").notNull(),
  message: text("message").notNull(),
  link: text("link"), // URL path to navigate to (e.g. /customers/email@example.com)
  sourceType: text("source_type"), // "note" | "task" | "escalation" | "payment"
  sourceId: text("source_id"), // ID of the source record
  actorId: text("actor_id"), // who triggered it (e.g. the note author)
  actorName: text("actor_name"), // denormalized for display
  readAt: integer("read_at", { mode: "timestamp" }), // null = unread
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertNotification = typeof notifications.$inferInsert;
export type SelectNotification = typeof notifications.$inferSelect;

/* ─── UCL Org Credentials ─── */
export const uclOrgs = sqliteTable("ucl_orgs", {
  id: text("id").primaryKey(), // UUIDv4
  orgName: text("org_name").notNull(),
  username: text("username").notNull(),
  password: text("password").notNull(),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  lastTestedAt: integer("last_tested_at", { mode: "timestamp" }),
  lastTestResult: text("last_test_result"), // "success" | "error"
  lastTestMessage: text("last_test_message"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
}, (table) => [
  uniqueIndex("ucl_orgs_org_name_idx").on(table.orgName),
]);

export type InsertUclOrg = typeof uclOrgs.$inferInsert;
export type SelectUclOrg = typeof uclOrgs.$inferSelect;

/* ─── UCL Global Config ─── */
export const uclGlobalConfig = sqliteTable("ucl_global_config", {
  id: text("id").primaryKey(), // single row, always "default"
  partnerCode: text("partner_code").notNull().default(""),
  clientId: text("client_id").notNull().default(""),
  clientSecret: text("client_secret").notNull().default(""),
  mvnoCode: text("mvno_code").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export type InsertUclGlobalConfig = typeof uclGlobalConfig.$inferInsert;
export type SelectUclGlobalConfig = typeof uclGlobalConfig.$inferSelect;
