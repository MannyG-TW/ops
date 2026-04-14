CREATE TABLE `internal_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`author_id` text NOT NULL,
	`author_name` text NOT NULL,
	`body` text NOT NULL,
	`mentions` text DEFAULT '[]' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `notifications` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`message` text NOT NULL,
	`link` text,
	`source_type` text,
	`source_id` text,
	`actor_id` text,
	`actor_name` text,
	`read_at` integer,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `ucl_global_config` (
	`id` text PRIMARY KEY NOT NULL,
	`partner_code` text DEFAULT '' NOT NULL,
	`client_id` text DEFAULT '' NOT NULL,
	`client_secret` text DEFAULT '' NOT NULL,
	`mvno_code` text DEFAULT '' NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE TABLE `ucl_orgs` (
	`id` text PRIMARY KEY NOT NULL,
	`org_name` text NOT NULL,
	`username` text NOT NULL,
	`password` text NOT NULL,
	`is_active` integer DEFAULT true NOT NULL,
	`last_tested_at` integer,
	`last_test_result` text,
	`last_test_message` text,
	`created_at` integer NOT NULL,
	`updated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `ucl_orgs_org_name_idx` ON `ucl_orgs` (`org_name`);