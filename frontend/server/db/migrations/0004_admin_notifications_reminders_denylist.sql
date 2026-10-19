CREATE TABLE "notifications"."admin_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text NOT NULL,
	"employee_id" integer,
	"employee_name" text,
	"created_at" timestamp with time zone,
	"admin_seen" boolean,
	"seen_at" timestamp with time zone,
	"bitrix_user_id" integer,
	"field" text,
	"platform_value" text,
	"bitrix_value" text,
	"years" integer,
	"sku" text,
	"order_id" text,
	"idea_id" text,
	"idea_title" text,
	"vacation_request_id" integer,
	"vacation_start" text,
	"vacation_end" text,
	"error_message" text,
	"vpn_peer_names" text[],
	"vpn_panel" text,
	"sales_period" text,
	"sales_period_label" text,
	"stars" integer,
	"comment" text,
	"page" text,
	"photo_id" text,
	"photo_ids" text[],
	"source_keys" text[],
	"extra" json,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "core"."access_denylist" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"bitrix_user_id" integer,
	"platform_user_id" integer,
	"email" text,
	"name" text,
	"employee_id" integer,
	"revoked_at" timestamp with time zone,
	"reason" text,
	"avatar_purge_at" timestamp with time zone,
	"vacations_purge_at" timestamp with time zone,
	"wallet_purge_at" timestamp with time zone,
	"purchases_purge_at" timestamp with time zone,
	"avatar_purged" boolean,
	"vacations_purged" boolean,
	"source_keys" text[],
	"extra" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacations"."manager_month_reminders" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"target_month" text,
	"manager" text,
	"bitrix_user_id" integer,
	"vacation_count" integer,
	"sent_at" text,
	"channel" text,
	"source_keys" text[],
	"extra" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vacations"."pre_reminders" (
	"key" text PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"kind" text,
	"request_id" integer,
	"employee" text,
	"bitrix_user_id" integer,
	"start" text,
	"end" text,
	"sent_at" text,
	"channel" text,
	"source_keys" text[],
	"extra" json,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "admin_notifications_created_idx" ON "notifications"."admin_notifications" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "admin_notifications_unseen_idx" ON "notifications"."admin_notifications" USING btree ("created_at") WHERE "notifications"."admin_notifications"."admin_seen" is not true;--> statement-breakpoint
CREATE INDEX "admin_notifications_kind_employee_idx" ON "notifications"."admin_notifications" USING btree ("kind","employee_id");--> statement-breakpoint
CREATE INDEX "admin_notifications_kind_vacation_idx" ON "notifications"."admin_notifications" USING btree ("kind","vacation_request_id");--> statement-breakpoint
CREATE INDEX "access_denylist_bitrix_idx" ON "core"."access_denylist" USING btree ("bitrix_user_id");--> statement-breakpoint
CREATE INDEX "access_denylist_employee_idx" ON "core"."access_denylist" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "access_denylist_email_idx" ON "core"."access_denylist" USING btree ("email");--> statement-breakpoint
CREATE INDEX "manager_month_reminders_target_idx" ON "vacations"."manager_month_reminders" USING btree ("target_month");--> statement-breakpoint
CREATE INDEX "pre_reminders_request_idx" ON "vacations"."pre_reminders" USING btree ("request_id");