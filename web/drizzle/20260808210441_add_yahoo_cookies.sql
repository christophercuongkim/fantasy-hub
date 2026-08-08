CREATE TABLE "yahoo_cookies" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"cookie_enc" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
