CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"meal_date" date NOT NULL,
	"eaten_at" time,
	"name" text NOT NULL,
	"description" text,
	"kcal" integer,
	"protein" integer,
	"carbs" integer,
	"fat" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"kcal" integer,
	"protein" integer,
	"carbs" integer,
	"fat" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "nutrition_targets_athlete_key" UNIQUE("athlete_id")
);
--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "meals_athlete_date_idx" ON "meals" USING btree ("athlete_id","meal_date");