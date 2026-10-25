CREATE SCHEMA "core";
--> statement-breakpoint
CREATE TABLE "core"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."employee_assignment_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"employee_id" integer NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"manager" text DEFAULT '' NOT NULL,
	"manager_id" integer,
	"valid_from" timestamp with time zone,
	"valid_to" timestamp with time zone,
	"source" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."employees" (
	"id" integer PRIMARY KEY NOT NULL,
	"name" text DEFAULT '' NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"manager" text DEFAULT '' NOT NULL,
	"manager_id" integer,
	"hired_at" date,
	"birthday" text,
	"platform_user_id" integer,
	"bitrix_user_id" integer,
	"email" text,
	"account_role" text,
	"vacation_opening_balance" double precision,
	"legal_entity" text,
	"contract_form" text,
	"position" integer DEFAULT 0 NOT NULL,
	"source_keys" text[],
	"extra" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."manager_assignments" (
	"employee_id" integer PRIMARY KEY NOT NULL,
	"manager_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."manager_assignments_by_name" (
	"name_key" text PRIMARY KEY NOT NULL,
	"manager_name" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."org_executives" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text DEFAULT '' NOT NULL,
	"person" text DEFAULT '' NOT NULL,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"grid_col" double precision,
	"grid_row" double precision,
	"x" double precision,
	"y" double precision,
	"position" integer DEFAULT 0 NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "core"."org_groups" (
	"id" text PRIMARY KEY NOT NULL,
	"executive_id" text NOT NULL,
	"label" text DEFAULT '' NOT NULL,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"label_x" double precision,
	"label_y" double precision,
	"grid_col" double precision,
	"grid_row" double precision,
	"x" double precision,
	"y" double precision,
	"width" double precision,
	"height" double precision,
	"position" integer DEFAULT 0 NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "core"."org_links" (
	"id" text PRIMARY KEY NOT NULL,
	"from_kind" text NOT NULL,
	"from_id" text NOT NULL,
	"from_side" text NOT NULL,
	"to_kind" text NOT NULL,
	"to_id" text NOT NULL,
	"to_side" text NOT NULL,
	"mid" double precision,
	"position" integer DEFAULT 0 NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
CREATE TABLE "core"."org_units" (
	"id" text PRIMARY KEY NOT NULL,
	"executive_id" text NOT NULL,
	"group_id" text,
	"stack_id" text,
	"name" text DEFAULT '' NOT NULL,
	"head" text DEFAULT '' NOT NULL,
	"sort_order" double precision DEFAULT 0 NOT NULL,
	"employees_count" integer DEFAULT 0 NOT NULL,
	"members" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"grid_col" double precision,
	"grid_row" double precision,
	"x" double precision,
	"y" double precision,
	"width" double precision,
	"height" double precision,
	"position" integer DEFAULT 0 NOT NULL,
	"extra" jsonb
);
--> statement-breakpoint
CREATE INDEX "employee_assignment_history_employee_idx" ON "core"."employee_assignment_history" USING btree ("employee_id","valid_from");--> statement-breakpoint
CREATE UNIQUE INDEX "employee_assignment_history_open_uq" ON "core"."employee_assignment_history" USING btree ("employee_id") WHERE "core"."employee_assignment_history"."valid_to" is null;--> statement-breakpoint
CREATE INDEX "employees_bitrix_user_id_idx" ON "core"."employees" USING btree ("bitrix_user_id");--> statement-breakpoint
CREATE INDEX "employees_platform_user_id_idx" ON "core"."employees" USING btree ("platform_user_id");--> statement-breakpoint
CREATE INDEX "employees_manager_id_idx" ON "core"."employees" USING btree ("manager_id");--> statement-breakpoint
CREATE INDEX "employees_email_idx" ON "core"."employees" USING btree (lower("email"));--> statement-breakpoint
CREATE INDEX "org_groups_executive_idx" ON "core"."org_groups" USING btree ("executive_id");--> statement-breakpoint
CREATE INDEX "org_units_executive_idx" ON "core"."org_units" USING btree ("executive_id");--> statement-breakpoint
CREATE INDEX "org_units_group_idx" ON "core"."org_units" USING btree ("group_id");