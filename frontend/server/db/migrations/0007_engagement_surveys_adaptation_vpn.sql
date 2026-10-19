CREATE SCHEMA "engagement";
--> statement-breakpoint
CREATE SCHEMA "surveys";
--> statement-breakpoint
CREATE SCHEMA "adaptation";
--> statement-breakpoint
CREATE SCHEMA "vpn";
--> statement-breakpoint
CREATE TABLE "engagement"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"easter_code" text,
	"finalized_at" timestamp with time zone,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."pit_stop_pairs" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"user_id_a" integer,
	"user_id_b" integer,
	"name_a" text,
	"name_b" text,
	"cipher" text,
	"assembly_turn" text,
	"assembly_step" integer,
	"ignition_held_by" json,
	"blind_role_a" text,
	"blind_x" double precision,
	"blind_y" double precision,
	"blind_started_at" timestamp with time zone,
	"puzzle_glow_a" json,
	"puzzle_glow_b" json,
	"puzzle_pressed_a" json,
	"puzzle_pressed_b" json,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."pit_stop_players" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text,
	"pair_id" text,
	"role" text,
	"is_remote" boolean,
	"checkpoints" json,
	"coffee_photo_path" text,
	"coffee_approved" boolean,
	"completed_at" timestamp with time zone,
	"rewards_granted" boolean,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."pit_stop_race_records" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text,
	"department" text,
	"best_ms" double precision,
	"color" text,
	"laps" integer,
	"best_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"history" json,
	"cheat" json,
	"source_keys" text[],
	"extra" json
);
--> statement-breakpoint
CREATE TABLE "engagement"."pit_stop_race_visits" (
	"user_id" integer PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"name" text,
	"at" timestamp with time zone,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "engagement"."pit_stop_race_winners" (
	"rank" integer PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"user_id" integer,
	"name" text,
	"best_ms" double precision,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys"."responses" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"survey_key" text NOT NULL,
	"survey_id" text,
	"submitted_at" timestamp with time zone,
	"answers" json,
	"respondent" json,
	"source_keys" text[],
	"extra" json
);
--> statement-breakpoint
CREATE TABLE "surveys"."start_counts" (
	"survey_id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys"."visit_counts" (
	"survey_id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"count" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys"."surveys" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"slug" text,
	"title" text,
	"description" text,
	"status" text,
	"anonymous" boolean,
	"questions" json,
	"created_by_user_id" integer,
	"created_by_name" text,
	"created_at" text,
	"updated_at" text,
	"published_at" timestamp with time zone,
	"source_keys" text[],
	"extra" json
);
--> statement-breakpoint
CREATE TABLE "surveys"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "surveys"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_survey_id" integer,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptation"."assignments" (
	"employee_id" integer PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"employee_name" text,
	"scenario_id" text,
	"assigned_at" timestamp with time zone,
	"assigned_by_user_id" integer,
	"assigned_by_name" text,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptation"."attempts" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"employee_id" integer,
	"employee_name" text,
	"platform_user_id" integer,
	"quiz_id" text,
	"phase" text,
	"quiz_title" text,
	"answers" json,
	"score_percent" double precision,
	"passed" boolean,
	"submitted_at" timestamp with time zone,
	"admin_seen" boolean,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptation"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptation"."scenarios" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text,
	"short_title" text,
	"description" text,
	"audience" text,
	"extra_steps_by_phase" json,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptation"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "adaptation"."step_completions" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"step_id" text,
	"employee_id" integer,
	"completed_at" timestamp with time zone,
	"completed_by_user_id" integer,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vpn"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vpn"."keys" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"user_id" integer,
	"user_email" text,
	"client_name" text,
	"created_at" timestamp with time zone,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vpn"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "pit_stop_players_pair_idx" ON "engagement"."pit_stop_players" USING btree ("pair_id");--> statement-breakpoint
CREATE INDEX "survey_responses_survey_idx" ON "surveys"."responses" USING btree ("survey_key");--> statement-breakpoint
CREATE INDEX "surveys_slug_idx" ON "surveys"."surveys" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "adaptation_attempts_employee_idx" ON "adaptation"."attempts" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "adaptation_steps_employee_idx" ON "adaptation"."step_completions" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "vpn_keys_user_idx" ON "vpn"."keys" USING btree ("user_id");