/**
 * Server-side credential accessors.
 *
 * Credentials for OpenSearch, TelliSIM, and UCL live in SQLite so scheduled jobs
 * and server-only agents can reach those systems without relying on the operator's
 * browser localStorage. Each function returns `null` when the config is missing.
 */

import { db } from "./db";
import { opensearchConfig, tellisimConfig } from "./db/schema";
import { eq } from "drizzle-orm";

export interface OpenSearchCredentials {
  url: string;
  username: string;
  password: string;
}

export interface TelliSIMCredentials {
  baseUrl: string;
  apiKey: string;
  orgId: string;
}

export function getServerOpenSearchCredentials(): OpenSearchCredentials | null {
  const row = db.select().from(opensearchConfig).where(eq(opensearchConfig.id, "default")).get();
  if (!row || !row.url || !row.username || !row.password) return null;
  return { url: row.url, username: row.username, password: row.password };
}

export function getServerTelliSIMCredentials(): TelliSIMCredentials | null {
  const row = db.select().from(tellisimConfig).where(eq(tellisimConfig.id, "default")).get();
  if (!row || !row.apiKey) return null;
  return { baseUrl: row.baseUrl, apiKey: row.apiKey, orgId: row.orgId };
}

/**
 * Resolve OpenSearch credentials for a request. The request body is
 * deliberately ignored: honoring a client-supplied url/username/password lets
 * any caller point the server at an arbitrary host (SSRF). No client sends
 * body credentials anymore (see settings-client.ts), so the DB is the only
 * source. The unused parameter keeps legacy call-sites compiling.
 */
export function resolveOpenSearchCredentials(_body?: unknown): OpenSearchCredentials | null {
  return getServerOpenSearchCredentials();
}

/**
 * Resolve TelliSIM credentials for a request. Like OpenSearch, the request body
 * is ignored: a client-supplied baseUrl would let any caller point the server at
 * an arbitrary host (SSRF) whenever the DB row is unset. Data routes always use
 * the DB. (The Settings "test connection" route reads body creds directly by
 * design, before they are saved — that is a separate, intentional surface.)
 * The unused parameter keeps legacy call-sites compiling.
 */
export function resolveTelliSIMCredentials(_body?: unknown): TelliSIMCredentials | null {
  return getServerTelliSIMCredentials();
}
