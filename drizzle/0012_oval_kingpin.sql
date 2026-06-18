ALTER TABLE "daily_metrics" ADD COLUMN IF NOT EXISTS "water_ml" integer;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD COLUMN IF NOT EXISTS "water_ml" integer;