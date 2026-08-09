import { createMemoryStore } from "./memory";
import { createPostgresStore } from "./postgres";
import type { Store } from "./types";

export type { Store } from "./types";
export { snapshot } from "./types";

/**
 * Storage, decided once.
 *
 * Vercel's filesystem is ephemeral and module memory does not survive a cold start, so an
 * in-memory log would empty itself on the exact deployed URL the submission requires,
 * and the feature it would silently break, replay, is the one that cannot be cut.
 *
 * So: Postgres whenever DATABASE_URL is set, in-memory otherwise for local work. The
 * seeded history is committed JSON loaded by both drivers, which means replay has
 * something real to replay even on the first request after a cold start.
 */
let cached: Store | null = null;

export function getStore(): Store {
  if (!cached) {
    cached = process.env.DATABASE_URL ? createPostgresStore() : createMemoryStore();
  }
  return cached;
}
