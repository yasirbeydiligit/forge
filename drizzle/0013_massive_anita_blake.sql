CREATE TYPE "public"."equipment_type" AS ENUM('barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'smith', 'ez_bar', 'trap_bar', 'other');--> statement-breakpoint
CREATE TYPE "public"."exercise_muscle_role" AS ENUM('primary', 'secondary');--> statement-breakpoint
CREATE TYPE "public"."movement_pattern" AS ENUM('push_horizontal', 'push_vertical', 'pull_horizontal', 'pull_vertical', 'squat', 'hinge', 'lunge', 'isolation', 'carry', 'core', 'rotation');--> statement-breakpoint
CREATE TYPE "public"."muscle_region" AS ENUM('upper', 'lower', 'core');--> statement-breakpoint
CREATE TABLE "exercise_alternatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"alternative_id" uuid NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_alternatives_unique" UNIQUE("exercise_id","alternative_id"),
	CONSTRAINT "exercise_alternatives_distinct" CHECK ("exercise_alternatives"."exercise_id" <> "exercise_alternatives"."alternative_id")
);
--> statement-breakpoint
CREATE TABLE "exercise_muscle_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"exercise_id" uuid NOT NULL,
	"muscle_function_id" uuid NOT NULL,
	"role" "exercise_muscle_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "exercise_muscle_targets_unique" UNIQUE("exercise_id","muscle_function_id")
);
--> statement-breakpoint
CREATE TABLE "muscle_functions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"muscle_id" uuid NOT NULL,
	"slug" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_technical" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "muscle_functions_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "muscles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name_tr" text NOT NULL,
	"name_latin" text,
	"region" "muscle_region" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "muscles_slug_key" UNIQUE("slug")
);
--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "slug" text;--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "movement_pattern" "movement_pattern";--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "equipment_type" "equipment_type";--> statement-breakpoint
ALTER TABLE "exercises" ADD COLUMN "is_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "log_sets" ADD COLUMN "rir" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD COLUMN "target_rir" numeric(3, 1);--> statement-breakpoint
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_alternative_id_exercises_id_fk" FOREIGN KEY ("alternative_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_alternatives" ADD CONSTRAINT "exercise_alternatives_created_by_profiles_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_targets" ADD CONSTRAINT "exercise_muscle_targets_exercise_id_exercises_id_fk" FOREIGN KEY ("exercise_id") REFERENCES "public"."exercises"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "exercise_muscle_targets" ADD CONSTRAINT "exercise_muscle_targets_muscle_function_id_muscle_functions_id_fk" FOREIGN KEY ("muscle_function_id") REFERENCES "public"."muscle_functions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "muscle_functions" ADD CONSTRAINT "muscle_functions_muscle_id_muscles_id_fk" FOREIGN KEY ("muscle_id") REFERENCES "public"."muscles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "exercise_alternatives_exercise_idx" ON "exercise_alternatives" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_muscle_targets_exercise_idx" ON "exercise_muscle_targets" USING btree ("exercise_id");--> statement-breakpoint
CREATE INDEX "exercise_muscle_targets_function_idx" ON "exercise_muscle_targets" USING btree ("muscle_function_id");--> statement-breakpoint
CREATE INDEX "muscle_functions_muscle_idx" ON "muscle_functions" USING btree ("muscle_id");--> statement-breakpoint
CREATE INDEX "exercises_pattern_idx" ON "exercises" USING btree ("movement_pattern");--> statement-breakpoint
ALTER TABLE "log_sets" DROP COLUMN "rpe";--> statement-breakpoint
ALTER TABLE "workout_exercises" DROP COLUMN "target_rpe";--> statement-breakpoint
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_slug_key" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "log_sets" ADD CONSTRAINT "log_sets_rir_range" CHECK ("log_sets"."rir" IS NULL OR ("log_sets"."rir" >= 0 AND "log_sets"."rir" <= 10));--> statement-breakpoint
ALTER TABLE "workout_exercises" ADD CONSTRAINT "workout_exercises_target_rir_range" CHECK ("workout_exercises"."target_rir" IS NULL OR ("workout_exercises"."target_rir" >= 0 AND "workout_exercises"."target_rir" <= 10));