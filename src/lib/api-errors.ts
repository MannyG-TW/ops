import { NextResponse } from "next/server";

/**
 * Turn an arbitrary thrown error into a client-safe JSON response.
 *
 * Upstream clients (OpenSearch, TelliSIM, UCL) embed response-body fragments,
 * internal URLs, and sometimes secrets in their thrown Error messages. Returning
 * `err.message` verbatim leaks those to the browser. This helper logs the full
 * error server-side and returns a generic message instead.
 *
 * One message class is allowed through unchanged because it is
 * operator-actionable and carries no upstream detail:
 *   - "... not configured ..." (e.g. "save credentials in Settings")
 */
export function sanitizeError(
  err: unknown,
  label: string,
  status: number = 500,
): NextResponse {
  console.error(`[${label}] request failed:`, err);

  const message = err instanceof Error ? err.message : String(err);

  if (/not configured/i.test(message)) {
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }
  if (err instanceof Error && err.name === "TimeoutError") {
    return NextResponse.json(
      { ok: false, error: `${label} request timed out` },
      { status: 504 },
    );
  }
  return NextResponse.json(
    { ok: false, error: `${label} request failed` },
    { status },
  );
}
