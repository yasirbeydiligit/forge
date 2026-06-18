import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Drizzle CLI commands (generate/migrate/push) read DATABASE_URL from .env.local.
config({ path: ".env.local" });

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
  // We manage RLS policies / triggers / storage in a companion custom migration,
  // so let drizzle-kit focus on table structure.
  verbose: true,
  strict: true,
});
