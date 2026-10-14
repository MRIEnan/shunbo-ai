// `prisma generate` validates that datasource env vars exist even though it never connects.
// Provide harmless placeholders when they're absent (fresh clones, CI steps without a DB).
import { execSync } from "node:child_process";
const env = { ...process.env };
env.DATABASE_URL ||= "postgresql://placeholder:placeholder@localhost:5432/placeholder";
env.DIRECT_URL ||= env.DATABASE_URL;
execSync("npx prisma generate", { stdio: "inherit", env });
