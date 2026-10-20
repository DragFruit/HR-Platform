CREATE TABLE "profile"."wishlists" (
	"employee_id" integer PRIMARY KEY NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"items" json NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
