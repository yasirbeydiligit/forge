CREATE TABLE "daily_metrics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"metric_date" date NOT NULL,
	"weight" numeric(5, 2),
	"sleep_hours" numeric(3, 1),
	"resting_hr" integer,
	"energy" integer,
	"hunger" integer,
	"adherence" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "daily_metrics_athlete_date_key" UNIQUE("athlete_id","metric_date")
);
--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "daily_metrics_athlete_date_idx" ON "daily_metrics" USING btree ("athlete_id","metric_date");