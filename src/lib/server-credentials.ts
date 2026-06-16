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
 * Resolve OpenSearch credentials for a request: prefer request body (legacy
 * localStorage-driven path), fall back to the DB. Lets us migrate gradually
 * without breaking existing client call-sites.
 */
export function resolveOpenSearchCredentials(body: { credentials?: unknown }): OpenSearchCredentials | null {
  const c = body?.credentials as Partial<OpenSearchCredentials> | undefined;
  if (c?.url && c.username && c.password) {
    return { url: c.url, username: c.username, password: c.password };
  }
  return getServerOpenSearchCredentials();
}

export function resolveTelliSIMCredentials(body: { credentials?: unknown }): TelliSIMCredentials | null {
  const c = body?.credentials as Partial<TelliSIMCredentials> | undefined;
  if (c?.apiKey) {
    return { baseUrl: c.baseUrl || "", apiKey: c.apiKey, orgId: c.orgId || "" };
  }
  return getServerTelliSIMCredentials();
}
