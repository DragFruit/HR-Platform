CREATE SCHEMA "ideas";
--> statement-breakpoint
CREATE SCHEMA "knowledge";
--> statement-breakpoint
CREATE TABLE "ideas"."user_votes" (
	"user_id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"votes" json NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas"."ideas" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"author_user_id" integer,
	"author_name" text,
	"title" text,
	"description" text,
	"category" text,
	"city" text,
	"status" text,
	"created_at" text,
	"votes_up" integer,
	"votes_down" integer,
	"attachment_name" text,
	"attachment_stored" boolean,
	"status_comment" text,
	"status_changed_at" timestamp with time zone,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ideas"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_idea_id" integer,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge"."articles" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"title" text,
	"summary" text,
	"body" text,
	"tags" text[],
	"breadcrumbs" text[],
	"departments" text[],
	"status" text,
	"created_at" timestamp with time zone,
	"updated_at" timestamp with time zone,
	"author_name" text,
	"author_user_id" integer,
	"comments" json,
	"pending_revision" json,
	"approved_at" timestamp with time zone,
	"rejection_reason" text,
	"submitted_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	"source_keys" text[],
	"extra" json,
	"row_updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge"."json_imports" (
	"source" text PRIMARY KEY NOT NULL,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"file_count" integer NOT NULL,
	"inserted" integer NOT NULL,
	"skipped" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "knowledge"."state" (
	"id" integer PRIMARY KEY NOT NULL,
	"next_id" integer,
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "ideas_author_idx" ON "ideas"."ideas" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "ideas_status_idx" ON "ideas"."ideas" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_articles_status_idx" ON "knowledge"."articles" USING btree ("status");--> statement-breakpoint
CREATE INDEX "knowledge_articles_author_idx" ON "knowledge"."articles" USING btree ("author_user_id");