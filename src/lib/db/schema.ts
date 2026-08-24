import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";

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

/* ─── Network Intent Events ─── */
// Machine-detected demand signal, NOT an agent-filed complaint (that is
// `connectivity_reports`). One row per network event TelliSIM reported in a
// country the customer's plan does not cover — i.e. they physically travelled
// somewhere we did not sell them coverage for.
//
// Stored at EVENT grain, keyed on (iccid, country, event_time, kind), so
// re-pulling an overlapping 7-day window is idempotent: repeat lookups
// `onConflictDoNothing` instead of inflating attempt counts. Country-level
// demand is a GROUP BY, not a stored counter.
export const networkIntentEvents = sqliteTable("network_intent_events", {
  id: text("id").primaryKey(), // UUIDv4
  iccid: text("iccid").notNull(),
  countryAlpha2: text("country_alpha_2").notNull(), // uppercase ISO2
  countryName: text("country_name"),
  operator: text("operator"),
  kind: text("kind").notNull(), // "2G_3G" | "4G_5G" | "DATA"
  requestType: text("request_type"), // Init / Update / Term — DATA events only
  eventTime: text("event_time").notNull(), // raw ISO-8601 from TelliSIM (offset may not be Z)
  succeeded: integer("succeeded", { mode: "boolean" }).notNull().default(false),
  // Plan context captured at detection time — the plan is what made this
  // country "uncovered", so it has to travel with the finding.
  coverageId: text("coverage_id"),
  planName: text("plan_name"),
  regionCode: text("region_code"),
  coveredCountries: text("covered_countries"), // JSON array of ISO2 the plan DID cover
  orderNumber: text("order_number"),
  customerEmail: text("customer_email"),
  detectedAt: integer("detected_at", { mode: "timestamp" }).notNull(),
  // Null = captured locally but not yet in OpenSearch. TelliSIM drops network
  // events after ~7 days, so a lost write is unrecoverable; SQLite acts as the
  // replay buffer and later calls retry anything still pending.
  osIndexedAt: integer("os_indexed_at", { mode: "timestamp" }),
}, (t) => [
  uniqueIndex("nie_event_idx").on(t.iccid, t.countryAlpha2, t.eventTime, t.kind),
  index("nie_pending_idx").on(t.osIndexedAt),
  index("nie_country_idx").on(t.countryAlpha2),
  index("nie_iccid_idx").on(t.iccid),
  index("nie_detected_idx").on(t.detectedAt),
]);

export type InsertNetworkIntentEvent = typeof networkIntentEvents.$inferInsert;
export type SelectNetworkIntentEvent = typeof networkIntentEvents.$inferSelect;

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

/* ─── Marketing: Customer Segments ─── */
// Materialized snapshot of OpenSearch purchasers — one row per (email × product
// segment). Rebuilt by the /api/marketing/sync action. The /marketing console
// queries THIS table (not OpenSearch) for all search/filter/export work.
export const marketingCustomerSegments = sqliteTable("marketing_customer_segments", {
  id: text("id").primaryKey(), // UUIDv4
  email: text("email").notNull(),
  name: text("name").notNull().default(""),
  firstName: text("first_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  system: text("system").notNull().default(""), // twus / tweu / …
  segment: text("segment").notNull(), // "eSIM" | "Rental" | "Sapphire" | "Other"
  firstPurchase: integer("first_purchase"), // epoch SECONDS
  lastPurchase: integer("last_purchase"), // epoch SECONDS
  orders: integer("orders").notNull().default(0),
  totalSpentUsd: real("total_spent_usd").notNull().default(0),
  destinations: text("destinations").notNull().default(""), // comma-separated country/region names
  lastTrip: integer("last_trip"), // epoch SECONDS — most recent rental trip-end (→ LAST_TRIP_AT)
  lastDestination: text("last_destination").notNull().default(""), // dest name of the most recent order w/ a destination (→ DEST_COUNTRY)
  lastDestAt: integer("last_dest_at"), // epoch SECONDS of that destination's order (to pick latest across segments)
  syncedAt: integer("synced_at", { mode: "timestamp" }).notNull(),
}, (t) => [
  uniqueIndex("mcs_email_segment_idx").on(t.email, t.segment),
  index("mcs_email_idx").on(t.email),
  index("mcs_segment_idx").on(t.segment),
  index("mcs_last_purchase_idx").on(t.lastPurchase),
]);

export type InsertMarketingCustomerSegment = typeof marketingCustomerSegments.$inferInsert;
export type SelectMarketingCustomerSegment = typeof marketingCustomerSegments.$inferSelect;

/* ─── Marketing: Omnisend Contacts ─── */
// Materialized from an uploaded Omnisend CSV export — one row per email.
// Joined onto customer segments at query time for consent/contact enrichment.
export const marketingContacts = sqliteTable("marketing_contacts", {
  email: text("email").primaryKey(), // lowercased
  firstName: text("first_name").notNull().default(""),
  lastName: text("last_name").notNull().default(""),
  phone: text("phone").notNull().default(""),
  emailStatus: text("email_status").notNull().default(""), // "Subscribed" | "Unsubscribed" | …
  emailConsent: text("email_consent").notNull().default(""),
  optIn: text("opt_in").notNull().default(""),
  smsStatus: text("sms_status").notNull().default(""),
  city: text("city").notNull().default(""),
  state: text("state").notNull().default(""),
  country: text("country").notNull().default(""),
  tags: text("tags").notNull().default(""),
  segments: text("segments").notNull().default(""),
  importedAt: integer("imported_at", { mode: "timestamp" }).notNull(),
});

export type InsertMarketingContact = typeof marketingContacts.$inferInsert;
export type SelectMarketingContact = typeof marketingContacts.$inferSelect;

/* ─── Marketing: Excluded Domains ─── */
// Email domains suppressed from marketing exports (internal/test). Growing list.
export const excludedDomains = sqliteTable("excluded_domains", {
  id: text("id").primaryKey(), // UUIDv4
  domain: text("domain").notNull(), // lowercased, e.g. "travelwifi.com"
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdBy: text("created_by"),
}, (t) => [
  uniqueIndex("excluded_domains_domain_idx").on(t.domain),
]);

export type InsertExcludedDomain = typeof excludedDomains.$inferInsert;
export type SelectExcludedDomain = typeof excludedDomains.$inferSelect;

/* ─── Marketing: Excluded Names ─── */
// Customer names suppressed regardless of domain (matched with variant expansion).
export const excludedNames = sqliteTable("excluded_names", {
  id: text("id").primaryKey(), // UUIDv4
  name: text("name").notNull(), // a name, or a full email address (matched exactly)
  variants: integer("variants", { mode: "boolean" }).notNull().default(true), // expand nickname variants?
  note: text("note"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  createdBy: text("created_by"),
});

export type InsertExcludedName = typeof excludedNames.$inferInsert;
export type SelectExcludedName = typeof excludedNames.$inferSelect;

/* ─── Marketing: Sync State ─── */
// Singleton (id = "default") recording when each source was last materialized.
export const marketingSyncState = sqliteTable("marketing_sync_state", {
  id: text("id").primaryKey(), // always "default"
  osSyncedAt: integer("os_synced_at", { mode: "timestamp" }),
  osSegmentRows: integer("os_segment_rows").notNull().default(0),
  osCustomers: integer("os_customers").notNull().default(0),
  omnisendImportedAt: integer("omnisend_imported_at", { mode: "timestamp" }),
  omnisendContacts: integer("omnisend_contacts").notNull().default(0),
});

export type InsertMarketingSyncState = typeof marketingSyncState.$inferInsert;
export type SelectMarketingSyncState = typeof marketingSyncState.$inferSelect;
