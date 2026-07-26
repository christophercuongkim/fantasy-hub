CREATE TABLE "yahoo_tokens" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
	"access_token_enc" text NOT NULL,
	"refresh_token_enc" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"guid" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
