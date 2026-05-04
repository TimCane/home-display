import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/web/server/db/schema.ts",
  out: "./src/web/server/db/migrations",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
