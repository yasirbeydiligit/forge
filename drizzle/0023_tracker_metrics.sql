CREATE TABLE "tracker_settings" (
	"athlete_id" uuid PRIMARY KEY NOT NULL,
	"enabled" jsonb NOT NULL,
	"goals" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "digestion" integer;--> statement-breakpoint
ALTER TABLE "tracker_settings" ADD CONSTRAINT "tracker_settings_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;