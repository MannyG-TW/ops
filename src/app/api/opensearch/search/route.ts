import { NextRequest, NextResponse } from "next/server";
import { queryOS } from "@/lib/opensearch-client";
import { resolveOpenSearchCredentials } from "@/lib/server-credentials";
import { INDEX_ORDERS } from "@/lib/opensearch-indices";

/**
 * Global search: query orders by order ID, serial/ICCID, or email.
 * Strategy: Try exact match first. If no results, fall back to broader search.
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { query, size = 20 } = body;
    const credentials = resolveOpenSearchCredentials(body);
    if (!query) {
      return NextResponse.json({ ok: false, error: "query required" }, { status: 400 });
    }
    if (!credentials?.url) {
      return NextResponse.json({ ok: false, error: "OpenSearch not configured — save credentials in Settings" }, { status: 400 });
    }

    // Strip whitespace and trailing punctuation (commas, periods, semicolons)
    // that users accidentally paste from spreadsheets or ticket lists
    const trimmed = query.trim().replace(/[,;.\s]+$/, "");

    const sourceFields = [
      "order_number", "customer_email", "customer_first_name", "customer_last_name",
      "status", "system", "total", "currency", "total_usd", "created_at",
      "serials", "product_sku", "destination_country", "order_details_data",
    ];

    // Detect query type for smarter searching
    const isEmail = trimmed.includes("@");
    const isNumericOnly = /^\d+$/.test(trimmed);
    const isOrderNumber = /^[A-Z]{2,}-\d+$/i.test(trimmed);

    // ─── Phase 1: Exact match on order_number, serial, or email ───
    const exactShould: Record<string, unknown>[] = [
      { term: { "order_number.keyword": { value: trimmed, boost: 10 } } },
      { term: { "serials.keyword": { value: trimmed, boost: 10 } } },
    ];

    // Email: try both original case and lowercase
    if (isEmail) {
      exactShould.push(
        { term: { "customer_email.keyword": { value: trimmed, boost: 10 } } },
        { term: { "customer_email.keyword": { value: trimmed.toLowerCase(), boost: 10 } } },
        // Also try match (analyzed, case-insensitive)
        { match: { customer_email: { query: trimmed, operator: "and", boost: 8 } } },
      );
    } else {
      exactShould.push(
        { term: { "customer_email.keyword": { value: trimmed.toLowerCase(), boost: 10 } } },
      );
    }

    const exactBody = {
      size: isEmail ? 50 : 5, // Email may match many orders from same customer
      query: {
        bool: {
          should: exactShould,
          minimum_should_match: 1,
        },
      },
      sort: [{ created_at: { order: "desc" } }],
      _source: sourceFields,
    };

    const exactResult = await queryOS(credentials, INDEX_ORDERS, exactBody);
    const exactHits = exactResult.hits?.hits || [];

    if (exactHits.length > 0) {
      const hits = exactHits.map((hit: Record<string, unknown>) => ({
        id: hit._id,
        ...hit._source as Record<string, unknown>,
      }));
      return NextResponse.json({ ok: true, total: exactHits.length, results: hits });
    }

    // ─── Phase 2: Broader search (wildcard + text match) ───
    // Suppress broad search when the query is a specific identifier that should
    // only match exactly:
    // - Order numbers (TWUS-271657, QRO-4473): if not in the index, "not found"
    //   is correct — broad search returns false positives from unrelated orders.
    // - ICCID-length numeric queries (≥15 digits): avoid false positives from
    //   shared carrier prefixes (e.g., 89480100...).
    const suppressBroad = isOrderNumber || (isNumericOnly && trimmed.length >= 15);

    if (suppressBroad) {
      return NextResponse.json({ ok: true, total: 0, results: [] });
    }

    const broadBody = {
      size,
      query: {
        bool: {
          should: [
            // Prefix match (more precise than wildcard)
            { prefix: { "order_number.keyword": { value: trimmed, boost: 5 } } },
            { prefix: { "serials.keyword": { value: trimmed, boost: 5 } } },
            // Wildcard as fallback
            { wildcard: { "order_number.keyword": { value: `*${trimmed}*`, boost: 2 } } },
            { wildcard: { "serials.keyword": { value: `*${trimmed}*`, boost: 2 } } },
            { wildcard: { "customer_email.keyword": { value: `*${trimmed.toLowerCase()}*`, boost: 2 } } },
            // Text match on name fields
            {
              multi_match: {
                query: trimmed,
                fields: ["customer_first_name", "customer_last_name", "customer_email"],
                type: "best_fields",
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
      sort: [{ _score: { order: "desc" } }, { created_at: { order: "desc" } }],
      _source: sourceFields,
    };

    const broadResult = await queryOS(credentials, INDEX_ORDERS, broadBody);
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
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
