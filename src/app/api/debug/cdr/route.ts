import { NextRequest, NextResponse } from "next/server";

/**
 * Debug endpoint to test CDR query directly.
 * POST body: { iccid, credentials: { url, username, password } }
 */
export async function POST(req: NextRequest) {
  try {
    const { iccid, credentials } = await req.json();

    if (!credentials?.url || !iccid) {
      return NextResponse.json({ error: "iccid and credentials required" });
    }

    const cleanUrl = credentials.url.replace(/\/$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (credentials.username && credentials.password) {
      headers["Authorization"] = `Basic ${Buffer.from(`${credentials.username}:${credentials.password}`).toString("base64")}`;
    }

    // Step 1: Check what indices exist
    const aliasRes = await fetch(`${cleanUrl}/_cat/aliases/tellisim-cdr-read?format=json`, {
      headers, signal: AbortSignal.timeout(10000),
    }).then(r => r.json()).catch(e => ({ error: e.message }));

    // Step 2: Try a simple query on tellisim-cdr-read
    const simpleQuery = {
      size: 3,
      query: {
        bool: {
          should: [
            { term: { ICCID: iccid } },
            { term: { "ICCID.keyword": iccid } },
            { match: { ICCID: { query: iccid, operator: "and" } } },
          ],
          minimum_should_match: 1,
        },
      },
    };

    const cdrRes = await fetch(`${cleanUrl}/tellisim-cdr-read/_search`, {
      method: "POST",
      headers,
      body: JSON.stringify(simpleQuery),
      signal: AbortSignal.timeout(10000),
    });
    const cdrData = await cdrRes.json();

    // Step 3: If no results, try without any filter to see what fields exist
    let sampleRecord = null;
    if (!cdrData.hits?.hits?.length) {
      const sampleQuery = { size: 1, query: { match_all: {} } };
      const sampleRes = await fetch(`${cleanUrl}/tellisim-cdr-read/_search`, {
        method: "POST", headers,
        body: JSON.stringify(sampleQuery),
        signal: AbortSignal.timeout(10000),
      });
      const sampleData = await sampleRes.json();
      sampleRecord = sampleData.hits?.hits?.[0]?._source;
    }

    // Step 4: Try wildcard index pattern
    let wildcardResult = null;
    const wildcardQuery = {
      size: 3,
      query: {
        bool: {
          should: [
            { term: { ICCID: iccid } },
            { match: { ICCID: iccid } },
            { wildcard: { "ICCID.keyword": `*${iccid}*` } },
          ],
          minimum_should_match: 1,
        },
      },
    };
    try {
      const wRes = await fetch(`${cleanUrl}/tellisim-cdr-*/_search`, {
        method: "POST", headers,
        body: JSON.stringify(wildcardQuery),
        signal: AbortSignal.timeout(10000),
      });
      const wData = await wRes.json();
      wildcardResult = {
        total: wData.hits?.total?.value,
        firstRecord: wData.hits?.hits?.[0]?._source,
        index: wData.hits?.hits?.[0]?._index,
      };
    } catch (e) {
      wildcardResult = { error: (e as Error).message };
    }

    return NextResponse.json({
      alias: aliasRes,
      queryUsed: simpleQuery,
      cdrResult: {
        total: cdrData.hits?.total?.value || 0,
        firstRecord: cdrData.hits?.hits?.[0]?._source,
        index: cdrData.hits?.hits?.[0]?._index,
      },
      sampleRecord,
      wildcardResult,
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message });
  }
}
