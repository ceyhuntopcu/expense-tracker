import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return drizzle(neon(url), { schema });
}

type Db = ReturnType<typeof createDb>;
let cached: Db | undefined;

// Lazy: the connection is only created on first query, never at build time.
export const db: Db = new Proxy({} as Db, {
  get(_target, prop) {
    cached ??= createDb();
    return cached[prop as keyof Db];
  },
});
