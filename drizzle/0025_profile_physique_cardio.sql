CREATE TYPE "public"."cardio_activity" AS ENUM('walk', 'run', 'swim', 'bike', 'elliptical', 'other');--> statement-breakpoint
CREATE TYPE "public"."training_goal" AS ENUM('muscle_gain', 'strength', 'fat_loss', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."user_sex" AS ENUM('male', 'female');--> statement-breakpoint
CREATE TYPE "public"."weight_unit" AS ENUM('kg', 'lb');--> statement-breakpoint
CREATE TABLE "cardio_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"session_date" date NOT NULL,
	"activity" "cardio_activity" NOT NULL,
	"duration_min" integer NOT NULL,
	"distance_km" numeric(6, 2),
	"calories" integer,
	"note" text,
	"source" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "physique_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"athlete_id" uuid NOT NULL,
	"photo_date" date NOT NULL,
	"storage_path" text NOT NULL,
	"note" text,
	"weight_kg" numeric(5, 2),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "physique_photos_storage_path_key" UNIQUE("storage_path")
);
--> statement-breakpoint
CREATE TABLE "profile_details" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"height_cm" integer,
	"birth_date" date,
	"sex" "user_sex",
	"unit" "weight_unit" DEFAULT 'kg' NOT NULL,
	"goal" "training_goal",
	"weekly_target_days" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "daily_metrics" ADD COLUMN "steps" integer;--> statement-breakpoint
ALTER TABLE "profiles" ADD COLUMN "username" text;--> statement-breakpoint
ALTER TABLE "cardio_sessions" ADD CONSTRAINT "cardio_sessions_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "physique_photos" ADD CONSTRAINT "physique_photos_athlete_id_profiles_id_fk" FOREIGN KEY ("athlete_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "profile_details" ADD CONSTRAINT "profile_details_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cardio_sessions_athlete_date_idx" ON "cardio_sessions" USING btree ("athlete_id","session_date");--> statement-breakpoint
CREATE INDEX "physique_photos_athlete_date_idx" ON "physique_photos" USING btree ("athlete_id","photo_date");--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_username_key" UNIQUE("username");