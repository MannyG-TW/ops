import { NextRequest, NextResponse } from "next/server";
import { queryOS } from "@/lib/opensearch-client";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";
import { INDEX_ORDERS } from "@/lib/opensearch-indices";

/**
 * Global search: query orders by order number, serial/ICCID, or email.
 * Strategy: Try exact match first. If no results, fall back to broader search.
 *
 * Order numbers are stored uppercase as PREFIX-digits (TWUS-271657, B2C-251912,
 * DSPUS-1912); prefixes may contain digits but always start with a letter.
 * All keyword-field clauses use case_insensitive because operators paste
 * lowercased values from chat/email/tickets.
 */

// Unicode hyphen look-alikes pasted from Word/Outlook/Docs (en/em dash, minus, …)
const DASH_VARIANTS = /[‐-―−﹘﹣－]/g;
// Wrapping decorations from ticket sentences: leading #/quotes/brackets,
// trailing sentence punctuation ("Can you check TWUS-271657?")
const LEADING_JUNK = /^[#("'[`\s]+/;
const TRAILING_JUNK = /[,;.:!?)"'\]`\s]+$/;
// "order TWUS-271657" / "ref: TWUS-271657" — strip the label only when an
// order-number-shaped token follows, so name/email searches are untouched
const LEADING_LABEL = /^(?:order|ord|ref|reference|no|num|number)[:#\s]+/i;

const ORDER_NUMBER = /^[A-Za-z][A-Za-z0-9]*-\d+$/;
// "DSPUS - 1912" — hyphen present but surrounded by spaces. Unconditional: a
// hyphen strongly signals an order number.
const SPACED_HYPHEN_ORDER = /^([A-Za-z][A-Za-z0-9]*)\s*-\s*(\d+)$/;
// "TWUS 271657" — a bare space instead of the hyphen. This shape collides with
// ordinary names ("Studio 54", "GUEST 0000"), so it is only treated as an order
// number when the prefix is a KNOWN system code (the `system` field's values).
const BARE_SPACE = /^([A-Za-z][A-Za-z0-9]{1,7}) (\d+)$/;
const SYSTEM_PREFIXES = new Set([
  "TWUS", "TWEU", "BC", "TWSG", "QRO", "B2C", "NVUS", "TWCL", "TWCH", "NVEU",
  "B2B", "KIOSK", "GNG", "TWFR", "TWFIUS", "TWID", "NVLOCAL", "TWLOCAL",
  "SKYPLUSUS", "AAFESUS", "NVCL", "CMRPUNTOSCL", "CMRPUNTOSUS", "FBLLCL",
  "FBLLUS", "SRUS", "DSPUS", "GTDCL", "AAFESLOCAL",
]);

/** Match "PREFIX 12345" only when PREFIX is a real system code. */
function bareSpacedOrder(q: string): RegExpMatchArray | null {
  const m = q.match(BARE_SPACE);
  return m && SYSTEM_PREFIXES.has(m[1].toUpperCase()) ? m : null;
}

function collapseSpacedOrder(q: string): string {
  const hy = q.match(SPACED_HYPHEN_ORDER);
  if (hy) return `${hy[1]}-${hy[2]}`;
  const bare = bareSpacedOrder(q);
  if (bare) return `${bare[1]}-${bare[2]}`;
  return q;
}

function normalizeQuery(raw: string): string {
  let q = raw.trim().replace(DASH_VARIANTS, "-");
  q = q.replace(LEADING_JUNK, "").replace(TRAILING_JUNK, "");
  const unlabeled = q.replace(LEADING_LABEL, "");
  if (
    unlabeled !== q &&
    (ORDER_NUMBER.test(unlabeled) ||
      SPACED_HYPHEN_ORDER.test(unlabeled) ||
      bareSpacedOrder(unlabeled) !== null)
  ) {
    q = unlabeled;
  }
  q = collapseSpacedOrder(q);
  // ICCIDs pasted from AT+CCID / device UIs carry a trailing hex F pad;
  // the index stores the unpadded form (verified: no F-suffixed serials)
  if (/^\d{18,19}[Ff]$/.test(q)) q = q.slice(0, -1);
  return q;
}

// * and ? are live metacharacters inside wildcard queries — a lone "*" would
// match the entire index
function escapeWildcard(s: string): string {
  return s.replace(/([*?\\])/g, "\\$1");
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, size: rawSize = 20 } = body;
    if (typeof query !== "string" || !query.trim()) {
      return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });
    }
    const size = Math.min(Math.max(Math.floor(Number(rawSize)) || 20, 1), 100);
    const credentials = resolveOpenSearchCredentials();
    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "OpenSearch not configured — save credentials in Settings" }, { status: 400 });
    }

    const trimmed = normalizeQuery(query);
    // Punctuation-only or single-char input normalizes to nothing useful and
    // would otherwise degenerate into a match-everything broad query
    if (trimmed.length < 2) {
      return NextResponse.json({ ok: true, total: 0, results: [] });
    }

    const sourceFields = [
      "order_number", "customer_email", "customer_name",
      "status", "system", "total", "currency_iso", "created_at",
      "serials", "product_sku", "order_details_data",
    ];

    // Detect query type for smarter searching
    const isEmail = trimmed.includes("@");
    const isNumericOnly = /^\d+$/.test(trimmed);
    const isOrderNumber = ORDER_NUMBER.test(trimmed);

    // ─── Phase 1: Exact match on order_number, serial, or email ───
    const exactShould: Record<string, unknown>[] = [
      { term: { "order_number.keyword": { value: trimmed, boost: 10, case_insensitive: true } } },
      { term: { "serials.keyword": { value: trimmed, boost: 10, case_insensitive: true } } },
    ];

    if (isEmail) {
      exactShould.push(
        { term: { "customer_email.keyword": { value: trimmed, boost: 10, case_insensitive: true } } },
        // Analyzed match catches stored variants the keyword term misses
        { match: { customer_email: { query: trimmed, operator: "and", boost: 8 } } },
      );
    }

    const exactBody = {
      size: isEmail ? Math.max(size, 50) : size, // email may match many orders from same customer
      query: {
        bool: {
          should: exactShould,
          minimum_should_match: 1,
        },
      },
      sort: [{ created_at: { order: "desc" } }],
      _source: sourceFields,
      track_total_hits: true,
    };

    const exactResult = await queryOS(credentials, INDEX_ORDERS, exactBody, {}, 15000, req.signal);
    const exactHits = exactResult.hits?.hits || [];

    if (exactHits.length > 0) {
      const hits = exactHits.map((hit: Record<string, unknown>) => ({
        id: hit._id,
        ...hit._source as Record<string, unknown>,
      }));
      return NextResponse.json({
        ok: true,
        total: exactResult.hits?.total?.value ?? exactHits.length,
        results: hits,
      });
    }

    // ─── Phase 2: Broader search (prefix/wildcard + text match) ───
    // Suppress broad search when the query is a specific identifier that should
    // only match exactly:
    // - Order numbers (TWUS-271657, B2C-4473): if not in the index, "not found"
    //   is correct — broad search returns false positives from unrelated orders.
    // - ICCID/IMEI-length numeric queries (≥15 digits): avoid false positives
    //   from shared carrier prefixes (e.g., 89480100...).
    const suppressBroad = isOrderNumber || (isNumericOnly && trimmed.length >= 15);

    if (suppressBroad) {
      return NextResponse.json({ ok: true, total: 0, results: [] });
    }

    const wc = escapeWildcard(trimmed);
    // Identifier clauses get constant scores far above anything BM25 can produce
    // from the text clause, so an order/serial hit always outranks a name/email
    // token match
    // Boost tiers, strictly ordered so ANY order/serial match outranks ANY
    // email match: order/serial prefix 100 > order/serial wildcard 80 >
    // email prefix 40 > email wildcard 30. (A real order matched only by
    // *wildcard* must still beat an email that merely starts with the fragment.)
    const broadShould: Record<string, unknown>[] = [
      { prefix: { "order_number.keyword": { value: trimmed, boost: 100, case_insensitive: true } } },
      { prefix: { "serials.keyword": { value: trimmed, boost: 100, case_insensitive: true } } },
      { prefix: { "customer_email.keyword": { value: trimmed, boost: 40, case_insensitive: true } } },
    ];
    // Leading wildcards are a full terms-dictionary scan across 231k docs —
    // only worth it for identifier fragments (digit-bearing), not for names
    if (/\d/.test(trimmed)) {
      broadShould.push(
        { wildcard: { "order_number.keyword": { value: `*${wc}*`, boost: 80, case_insensitive: true } } },
        { wildcard: { "serials.keyword": { value: `*${wc}*`, boost: 80, case_insensitive: true } } },
        { wildcard: { "customer_email.keyword": { value: `*${wc}*`, boost: 30, case_insensitive: true } } },
      );
    }
    // operator "and": every token must match within a field, so a lone numeric
    // token in an email can no longer surface an unrelated order
    broadShould.push({
      multi_match: {
        query: trimmed,
        fields: ["customer_name", "customer_email"],
        type: "best_fields",
        operator: "and",
      },
    });

    const broadBody = {
      size,
      query: {
        bool: {
          should: broadShould,
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: "desc" } }, { created_at: { order: "desc" } }],
      _source: sourceFields,
      track_total_hits: true,
    };

    const broadResult = await queryOS(credentials, INDEX_ORDERS, broadBody, {}, 15000, req.signal);
    const broadHits = broadResult.hits?.hits?.map((hit: Record<string, unknown>) => ({
      id: hit._id,
      ...hit._source as Record<string, unknown>,
    })) || [];

    return NextResponse.json({
      ok: true,
      total: broadResult.hits?.total?.value || 0,
      results: broadHits,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "TimeoutError") {
      return NextResponse.json({ ok: false, error: "Search timed out — try a more specific query" }, { status: 504 });
    }
    // Upstream error bodies stay in server logs; clients get a generic message
    console.error("[opensearch/search] query failed:", err);
    return NextResponse.json({ ok: false, error: "Search backend error" }, { status: 500 });
  }
}
