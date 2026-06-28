CREATE TYPE "public"."protocol_timing" AS ENUM('morning', 'pre_workout', 'intra_workout', 'post_workout', 'night');--> statement-breakpoint
CREATE TABLE "meal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"kcal" integer,
	"protein" integer,
	"carbs" integer,
	"fat" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "protocol_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"assigned_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protocol_assignments_unique" UNIQUE("protocol_id","athlete_id")
);
--> statement-breakpoint
CREATE TABLE "protocol_completions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"protocol_id" uuid NOT NULL,
	"athlete_id" uuid NOT NULL,
	"completion_date" date NOT NULL,
	"completed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "protocol_completions_unique" UNIQUE("protocol_id","athlete_id","completion_date")
);
--> statement-breakpoint
CREATE TABLE "protocol_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"timing" "protocol_timing" NOT NULL,
	"instructions" text,
	"order_index" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_assignments" ADD CONSTRAINT "protocol_assignments_protocol_id_protocol_templates_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocol_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_assignments" ADD CONSTRAINT "protocol_assignments_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_assignments" ADD CONSTRAINT "protocol_assignments_assigned_by_profiles_id_fk" FOREIGN KEY ("assigned_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_completions" ADD CONSTRAINT "protocol_completions_protocol_id_protocol_templates_id_fk" FOREIGN KEY ("protocol_id") REFERENCES "public"."protocol_templates"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_completions" ADD CONSTRAINT "protocol_completions_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "protocol_templates" ADD CONSTRAINT "protocol_templates_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meal_templates_athlete_idx" ON "meal_templates" USING btree ("athlete_id");--> statement-breakpoint
CREATE INDEX "protocol_assignments_athlete_idx" ON "protocol_assignments" USING btree ("athlete_id");--> statement-breakpoint
CREATE INDEX "protocol_completions_athlete_date_idx" ON "protocol_completions" USING btree ("athlete_id","completion_date");--> statement-breakpoint
CREATE INDEX "protocol_templates_active_idx" ON "protocol_templates" USING btree ("is_active","timing","order_index");