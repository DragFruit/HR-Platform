CREATE SCHEMA "vacations";
--> statement-breakpoint
CREATE TABLE "vacations"."request_status_history" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"request_id" integer NOT NULL,
	"changed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"kind" text NOT NULL,
	"actor_employee_id" integer,
	"reason" text,
	"status_before" text,
	"status_after" text,
	"approval_step_before" text,
	"approval_step_after" text,
	"start_before" text,
	"start_after" text,
	"end_before" text,
	"end_after" text
);
--> statement-breakpoint
CREATE TABLE "vacations"."requests" (
	"id" integer PRIMARY KEY NOT NULL,
	"bucket_year" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"employee" text,
	"employee_id" integer,
	"start_date" date,
	"end_date" date,
	"status" text,
	"approval_step" text,
	"comment" text,
	"created_at_text" text,
	"bitrix_absence_id" integer,
	"bitrix_absence_iblock_id" integer,
	"bitrix_sync_status" text,
	"bitrix_sync_method" text,
	"bitrix_synced_at" text,
	"bitrix_sync_error" text,
	"source_keys" text[],
	"extra" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacations"."reservations" (
	"id" integer PRIMARY KEY NOT NULL,
	"bucket_year" text NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"employee" text,
	"employee_id" integer,
	"year" integer,
	"month" integer,
	"duration_days" double precision,
	"comment" text,
	"created_at_text" text,
	"expiry_notice_sent_at" text,
	"source_keys" text[],
	"extra" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacations"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"primary_year" integer,
	"next_request_id" integer,
	"next_reservation_id" integer,
	"request_years" text[] NOT NULL,
	"reservation_years" text[] NOT NULL,
	"qa_demo_suppressed" json,
	"reservation_monthly_caps_by_group" json,
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacations"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX "request_status_history_request_idx" ON "vacations"."request_status_history" USING btree ("request_id","changed_at");--> statement-breakpoint
CREATE INDEX "requests_bucket_idx" ON "vacations"."requests" USING btree ("bucket_year","position");--> statement-breakpoint
CREATE INDEX "requests_employee_id_idx" ON "vacations"."requests" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "requests_status_idx" ON "vacations"."requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "requests_bitrix_absence_idx" ON "vacations"."requests" USING btree ("bitrix_absence_id");--> statement-breakpoint
CREATE INDEX "reservations_bucket_idx" ON "vacations"."reservations" USING btree ("bucket_year","position");--> statement-breakpoint
CREATE INDEX "reservations_employee_id_idx" ON "vacations"."reservations" USING btree ("employee_id");