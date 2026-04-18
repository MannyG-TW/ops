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
  portalUsername: text("portal_username").notNull().default(""),
  portalPassword: text("portal_password").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export type InsertUclGlobalConfig = typeof uclGlobalConfig.$inferInsert;
export type SelectUclGlobalConfig = typeof uclGlobalConfig.$inferSelect;

/* ─── OpenSearch Cluster Credentials ─── */
// Singleton row (id = "default"). Stored server-side so scheduled jobs and
// server-only agents can reach the cluster without relying on browser localStorage.
export const opensearchConfig = sqliteTable("opensearch_config", {
  id: text("id").primaryKey(), // always "default"
  url: text("url").notNull().default(""),
  username: text("username").notNull().default(""),
  password: text("password").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
export type InsertOpenSearchConfig = typeof opensearchConfig.$inferInsert;
export type SelectOpenSearchConfig = typeof opensearchConfig.$inferSelect;

/* ─── TelliSIM Credentials ─── */
export const tellisimConfig = sqliteTable("tellisim_config", {
  id: text("id").primaryKey(), // always "default"
  baseUrl: text("base_url").notNull().default(""),
  apiKey: text("api_key").notNull().default(""),
  orgId: text("org_id").notNull().default(""),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});
export type InsertTelliSimConfig = typeof tellisimConfig.$inferInsert;
export type SelectTelliSimConfig = typeof tellisimConfig.$inferSelect;

/* ─── Escalations ─── */
export const escalations = sqliteTable("escalations", {
  id: text("id").primaryKey(), // UUIDv4
  orderId: text("order_id").notNull(), // OpenSearch order ID
  orderNumber: text("order_number").notNull(), // denormalized for list display
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  status: text("status").notNull().default("new"), // "new" | "in_review" | "resolved"
  escalatedBy: text("escalated_by").notNull(), // agent name
  escalatedById: text("escalated_by_id").notNull(), // agent user ID
  resolvedBy: text("resolved_by"), // supervisor name
  resolvedById: text("resolved_by_id"), // supervisor user ID
  resolvedAt: integer("resolved_at", { mode: "timestamp" }),
  resolution: text("resolution"), // final resolution note
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export type InsertEscalation = typeof escalations.$inferInsert;
export type SelectEscalation = typeof escalations.$inferSelect;

/* ─── Escalation Notes ─── */
export const escalationNotes = sqliteTable("escalation_notes", {
  id: text("id").primaryKey(), // UUIDv4
  escalationId: text("escalation_id").notNull(), // FK to escalations.id
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  authorRole: text("author_role").notNull(), // "agent" | "supervisor" | "admin"
  content: text("content").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertEscalationNote = typeof escalationNotes.$inferInsert;
export type SelectEscalationNote = typeof escalationNotes.$inferSelect;

/* ─── Broadcasts ─── */
export const broadcasts = sqliteTable("broadcasts", {
  id: text("id").primaryKey(), // UUIDv4
  title: text("title").notNull(),
  message: text("message").notNull(),
  authorId: text("author_id").notNull(),
  authorName: text("author_name").notNull(),
  startsAt: integer("starts_at", { mode: "timestamp" }).notNull(),
  endsAt: integer("ends_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
});

export type InsertBroadcast = typeof broadcasts.$inferInsert;
export type SelectBroadcast = typeof broadcasts.$inferSelect;

/* ─── Fraud Reports ─── */
export const fraudReports = sqliteTable("fraud_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerName: text("customer_name").notNull(),
  customerEmail: text("customer_email").notNull(),
  notes: text("notes").notNull(),
  reportedBy: text("reported_by").notNull(),
  reportedById: text("reported_by_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertFraudReport = typeof fraudReports.$inferInsert;
export type SelectFraudReport = typeof fraudReports.$inferSelect;

/* ─── Connectivity Reports ─── */
export const connectivityReports = sqliteTable("connectivity_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerEmail: text("customer_email").notNull(),
  country: text("country").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  telliSimData: text("tellisim_data"),
  reportedBy: text("reported_by").notNull(),
  reportedById: text("reported_by_id").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertConnectivityReport = typeof connectivityReports.$inferInsert;
export type SelectConnectivityReport = typeof connectivityReports.$inferSelect;

/* ─── Refund Reports ─── */
export const refundReports = sqliteTable("refund_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerEmail: text("customer_email").notNull(),
  type: text("type").notNull(),
  amount: integer("amount").notNull(),
  currency: text("currency").notNull(),
  reason: text("reason").notNull(),
  country: text("country"),
  notes: text("notes"),
  processedBy: text("processed_by").notNull(),
  processedById: text("processed_by_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertRefundReport = typeof refundReports.$inferInsert;
export type SelectRefundReport = typeof refundReports.$inferSelect;

/* ─── Cancel Reports ─── */
export const cancelReports = sqliteTable("cancel_reports", {
  id: text("id").primaryKey(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number").notNull(),
  customerEmail: text("customer_email").notNull(),
  reason: text("reason").notNull(),
  notes: text("notes"),
  cancelledBy: text("cancelled_by").notNull(),
  cancelledById: text("cancelled_by_id").notNull(),
  status: text("status").notNull().default("pending"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
});

export type InsertCancelReport = typeof cancelReports.$inferInsert;
export type SelectCancelReport = typeof cancelReports.$inferSelect;

/* ─── Dashboard Config ─── */
export const dashboardConfig = sqliteTable("dashboard_config", {
  id: text("id").primaryKey(),
  connectivityThreshold: integer("connectivity_threshold").notNull().default(10),
  connectivityWindowHours: integer("connectivity_window_hours").notNull().default(48),
  updatedAt: integer("updated_at", { mode: "timestamp" }),
  updatedBy: text("updated_by"),
});

export type InsertDashboardConfig = typeof dashboardConfig.$inferInsert;
export type SelectDashboardConfig = typeof dashboardConfig.$inferSelect;
