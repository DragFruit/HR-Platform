CREATE SCHEMA "notifications";
--> statement-breakpoint
CREATE TABLE "notifications"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications"."user_notifications" (
	"id" uuid PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"recipient_user_id" integer NOT NULL,
	"vacation_request_id" integer,
	"employee_name" text DEFAULT '' NOT NULL,
	"start_date" date,
	"end_date" date,
	"stage_label" text,
	"idea_id" text,
	"idea_title" text,
	"status_comment" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"seen" boolean DEFAULT false NOT NULL,
	"seen_at" timestamp with time zone,
	"hidden_from_bell" boolean DEFAULT false NOT NULL,
	"hidden_at" timestamp with time zone,
	"extra" jsonb
);
--> statement-breakpoint
CREATE INDEX "user_notifications_recipient_created_idx" ON "notifications"."user_notifications" USING btree ("recipient_user_id","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "user_notifications_unseen_bell_idx" ON "notifications"."user_notifications" USING btree ("recipient_user_id") WHERE "notifications"."user_notifications"."seen" = false and "notifications"."user_notifications"."hidden_from_bell" = false;--> statement-breakpoint
CREATE INDEX "user_notifications_kind_vacation_idx" ON "notifications"."user_notifications" USING btree ("kind","vacation_request_id");