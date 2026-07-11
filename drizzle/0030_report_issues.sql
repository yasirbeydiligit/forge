CREATE TYPE "public"."report_period_type" AS ENUM('weekly', 'monthly', 'milestone');--> statement-breakpoint
CREATE TABLE "report_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"period_type" "report_period_type" NOT NULL,
	"period_start" date NOT NULL,
	"period_end" date NOT NULL,
	"milestone_months" integer,
	"issue_number" integer NOT NULL,
	"payload" jsonb NOT NULL,
	"read_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "report_issues_athlete_type_end_key" UNIQUE("athlete_id","period_type","period_end"),
	CONSTRAINT "report_issues_milestone_months_check" CHECK (("report_issues"."period_type" = 'milestone') = ("report_issues"."milestone_months" IS NOT NULL))
);
--> statement-breakpoint
ALTER TABLE "report_issues" ADD CONSTRAINT "report_issues_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "report_issues_athlete_idx" ON "report_issues" USING btree ("athlete_id","period_end");