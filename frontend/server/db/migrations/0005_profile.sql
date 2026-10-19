CREATE SCHEMA "profile";
--> statement-breakpoint
CREATE TABLE "profile"."activity" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"employee_id" integer,
	"platform_user_id" integer,
	"kind" text,
	"text" text,
	"occurred_at" timestamp with time zone,
	"source" text,
	"created_at" timestamp with time zone,
	"created_by_user_id" integer,
	"created_by_name" text,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile"."sales_best_awards" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"period" text,
	"employee_id" integer,
	"employee_name" text,
	"selected_at" timestamp with time zone,
	"selected_by" integer,
	"reveal_on" text,
	"activity_id" text,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile"."user_avatars" (
	"user_id" text PRIMARY KEY NOT NULL,
	"character_id" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profile"."vibe_passwords" (
	"employee_id" integer PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"password_hash" text,
	"password_seal" text,
	"updated_at" timestamp with time zone,
	"source_keys" text[],
	"extra" json
);
--> statement-breakpoint
CREATE INDEX "profile_activity_employee_idx" ON "profile"."activity" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "profile_activity_platform_user_idx" ON "profile"."activity" USING btree ("platform_user_id");--> statement-breakpoint
CREATE INDEX "sales_best_awards_period_idx" ON "profile"."sales_best_awards" USING btree ("period");--> statement-breakpoint
CREATE INDEX "sales_best_awards_employee_idx" ON "profile"."sales_best_awards" USING btree ("employee_id");