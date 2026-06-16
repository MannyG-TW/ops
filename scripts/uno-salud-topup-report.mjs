/**
 * UNO SALUD Top-Up Report Generator
 *
 * Generates a detailed report of data consumption and top-up history
 * for Sapphire devices, querying the ops_page API (which reads from OpenSearch).
 *
 * Usage: node scripts/uno-salud-topup-report.mjs [--month YYYY-MM] [--dry-run]
 *
 * Output: delme/UNO_SALUD_TopUp_Report.xlsx
 */

import XLSX from "xlsx";
import fs from "fs";

const API_BASE = "http://localhost:5000";
const PLAN_SIZE_BYTES = 4 * 1073741824; // 4 GB
const PLAN_SIZE_GB = 4;

// ─── Read IMEIs ───

function readImeis() {
  const wb = XLSX.readFile("delme/UNO SALUD IMEI.xlsx");
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  // Each row is [IMEI] — filter out empty/header rows
  return rows
    .flat()
    .map((v) => String(v).trim())
    .filter((v) => /^\d{15}$/.test(v));
}

// ─── API Helpers ───

async function fetchUsageReport(imeis, from, to) {
  const res = await fetch(`${API_BASE}/api/opensearch/usage-report`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imeis, from, to, noonToNoon: false }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`Usage report failed: ${json.error}`);
  return json;
}

async function fetchRawCdr(imei, from, to, size = 2000) {
  const res = await fetch(`${API_BASE}/api/opensearch/cdr`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imei, from, to, size }),
  });
  const json = await res.json();
  if (!json.ok) throw new Error(`CDR fetch failed: ${json.error}`);
  const records = json.cdr?.ucl?.records || [];
  const total = json.cdr?.ucl?.total || 0;
  if (records.length < total) {
    console.warn(`    ⚠ CDR truncated for ${imei}: got ${records.length}/${total} records`);
  }
  return records;
}

// ─── Phase 1: Monthly daily usage for all IMEIs ───

async function getMonthlyUsage(imeis, year, month) {
  const mm = String(month).padStart(2, "0");
  const from = `${year}-${mm}-01`;
  // Last day of month
  const lastDay = new Date(year, month, 0).getDate();
  const to = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

  console.log(`  Querying usage: ${from} → ${to} (${imeis.length} IMEIs)...`);
  const result = await fetchUsageReport(imeis, from, to);
  return { data: result.data, from, to, lastDay };
}

// ─── Phase 2: Detect top-up days ───

function detectTopups(dailyData, lastDay, year, month) {
  // dailyData: { "YYYY-MM-DD": bytesNumber }
  const mm = String(month).padStart(2, "0");
  let cumulative = 0;
  let nextBoundary = PLAN_SIZE_BYTES;
  const topupDays = [];
  const dailyEntries = [];

  for (let d = 1; d <= lastDay; d++) {
    const dateStr = `${year}-${mm}-${String(d).padStart(2, "0")}`;
    const dayBytes = dailyData[dateStr] || 0;
    cumulative += dayBytes;

    dailyEntries.push({ date: dateStr, bytes: dayBytes, cumulative });

    // Check if cumulative crossed the next 4GB boundary
    while (cumulative >= nextBoundary) {
      topupDays.push({
        date: dateStr,
        boundaryGB: nextBoundary / 1073741824,
        priorDayCumulative: cumulative - dayBytes,
        dayBytes,
      });
      nextBoundary += PLAN_SIZE_BYTES;
    }
  }

  return { dailyEntries, topupDays, totalBytes: cumulative };
}

// ─── Phase 3: Find exact top-up timestamp from raw CDR ───

async function findTopupTimestamp(imei, topup, year, month) {
  const { date, priorDayCumulative } = topup;
  const boundaryBytes = topup.boundaryGB * 1073741824;
  // How many bytes into this day does the boundary fall?
  const bytesNeeded = boundaryBytes - priorDayCumulative;

  // Fetch raw CDR for this day, sorted ascending by time
  const records = await fetchRawCdr(
    imei,
    `${date}T00:00:00Z`,
    `${date}T23:59:59Z`,
    500
  );

  // Sort ascending by timestamp
  records.sort(
    (a, b) => new Date(a["@timestamp"]).getTime() - new Date(b["@timestamp"]).getTime()
  );

  // Walk through records, accumulating bytes until we cross the boundary
  let dayAccum = 0;
  for (const rec of records) {
    dayAccum += rec.flowsize || 0;
    if (dayAccum >= bytesNeeded) {
      return {
        timestamp: rec.start_time_date || rec["@timestamp"],
        customer: rec.customer,
        country: rec.country,
        package: rec.package,
        sessionFlow: rec.flowsize,
      };
    }
  }

  // Couldn't pinpoint — return best guess (last record of the day)
  const last = records[records.length - 1];
  return {
    timestamp: last?.start_time_date || last?.["@timestamp"] || `${date}T23:59:59Z`,
    customer: last?.customer,
    country: last?.country,
    package: last?.package,
    sessionFlow: last?.flowsize,
    approximate: true,
  };
}

// ─── Phase 4: Build Excel ───

function buildExcel(allMonthData, imeis) {
  const wb = XLSX.utils.book_new();

  for (const { year, month, monthLabel, imeiResults } of allMonthData) {
    // Summary sheet data
    const summaryRows = [];
    summaryRows.push([
      "IMEI",
      "Organization",
      "Country",
      "Total Usage (GB)",
      "Plan (GB)",
      "Top-Ups",
      "Top-Up Dates/Times",
    ]);

    for (const { imei, totalBytes, topupDays, topupDetails, org, country } of imeiResults) {
      const topupStr = topupDetails
        .map((t) => `${t.timestamp?.slice(0, 19) || "unknown"}`)
        .join("; ");
      summaryRows.push([
        imei,
        org || "",
        country || "",
        +(totalBytes / 1073741824).toFixed(3),
        PLAN_SIZE_GB,
        topupDays.length,
        topupStr,
      ]);
    }

    const summaryWs = XLSX.utils.aoa_to_sheet(summaryRows);
    // Set column widths
    summaryWs["!cols"] = [
      { wch: 18 }, // IMEI
      { wch: 18 }, // Org
      { wch: 8 },  // Country
      { wch: 14 }, // Total Usage
      { wch: 8 },  // Plan
      { wch: 8 },  // Top-Ups
      { wch: 50 }, // Top-Up Dates
    ];
    XLSX.utils.book_append_sheet(wb, summaryWs, `${monthLabel} Summary`);

    // Daily detail sheet
    const detailRows = [];
    // Header: IMEI | Date1 | Date2 | ... | Total
    const mm = String(month).padStart(2, "0");
    const lastDay = new Date(year, month, 0).getDate();
    const dates = [];
    for (let d = 1; d <= lastDay; d++) {
      dates.push(`${year}-${mm}-${String(d).padStart(2, "0")}`);
    }
    detailRows.push(["IMEI", ...dates, "Total (GB)", "Top-Ups"]);

    for (const { imei, dailyEntries, totalBytes, topupDays } of imeiResults) {
      const dayMap = {};
      for (const e of dailyEntries) dayMap[e.date] = e.bytes;
      const row = [
        imei,
        ...dates.map((d) => {
          const b = dayMap[d] || 0;
          return b > 0 ? +(b / 1048576).toFixed(2) : 0; // MB
        }),
        +(totalBytes / 1073741824).toFixed(3),
        topupDays.length,
      ];
      detailRows.push(row);
    }

    const detailWs = XLSX.utils.aoa_to_sheet(detailRows);
    detailWs["!cols"] = [
      { wch: 18 },
      ...dates.map(() => ({ wch: 10 })),
      { wch: 12 },
      { wch: 8 },
    ];
    XLSX.utils.book_append_sheet(wb, detailWs, `${monthLabel} Daily (MB)`);
  }

  // Top-Ups detail sheet (all months)
  const topupRows = [["Month", "IMEI", "Top-Up #", "Boundary (GB)", "Date/Time", "Customer", "Country", "Approximate?"]];
  for (const { monthLabel, imeiResults } of allMonthData) {
    for (const { imei, topupDetails } of imeiResults) {
      topupDetails.forEach((t, i) => {
        topupRows.push([
          monthLabel,
          imei,
          i + 1,
          t.boundaryGB,
          t.timestamp?.slice(0, 19) || "unknown",
          t.customer || "",
          t.country || "",
          t.approximate ? "Yes" : "",
        ]);
      });
    }
  }
  const topupWs = XLSX.utils.aoa_to_sheet(topupRows);
  topupWs["!cols"] = [
    { wch: 10 }, { wch: 18 }, { wch: 8 }, { wch: 12 },
    { wch: 22 }, { wch: 35 }, { wch: 8 }, { wch: 12 },
  ];
  XLSX.utils.book_append_sheet(wb, topupWs, "All Top-Ups");

  return wb;
}

// ─── Main ───

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");

  console.log("═══ UNO SALUD Top-Up Report Generator ═══\n");

  // Read IMEIs
  const imeis = readImeis();
  console.log(`Found ${imeis.length} IMEIs\n`);

  if (imeis.length === 0) {
    console.error("No IMEIs found in the Excel file!");
    process.exit(1);
  }

  // Months to process (YTD: Jan-Apr 2026)
  const months = [
    { year: 2026, month: 1, label: "Jan 2026" },
    { year: 2026, month: 2, label: "Feb 2026" },
    { year: 2026, month: 3, label: "Mar 2026" },
    { year: 2026, month: 4, label: "Apr 2026" },
  ];

  if (dryRun) {
    console.log("DRY RUN: Would process months:", months.map((m) => m.label).join(", "));
    console.log("IMEIs:", imeis.slice(0, 5).join(", "), `... (${imeis.length} total)`);
    return;
  }

  const allMonthData = [];

  for (const { year, month, label } of months) {
    console.log(`\n── ${label} ──`);

    // Phase 1: Get daily usage
    const { data, lastDay } = await getMonthlyUsage(imeis, year, month);

    const imeiResults = [];
    const topupQueries = []; // Collect all top-up lookups

    // Phase 2: Detect top-ups for each IMEI
    for (const imei of imeis) {
      const dailyData = data[imei] || {};
      const { dailyEntries, topupDays, totalBytes } = detectTopups(
        dailyData, lastDay, year, month
      );
      imeiResults.push({ imei, dailyEntries, topupDays, totalBytes, topupDetails: [] });

      for (const topup of topupDays) {
        topupQueries.push({ imei, topup, resultIndex: imeiResults.length - 1 });
      }
    }

    const activeImeis = imeiResults.filter((r) => r.totalBytes > 0).length;
    const totalTopups = topupQueries.length;
    console.log(`  Active IMEIs: ${activeImeis}/${imeis.length}`);
    console.log(`  Top-ups detected: ${totalTopups}`);

    // Phase 3: Find exact timestamps for top-ups (sequential to avoid hammering OS)
    if (totalTopups > 0) {
      console.log(`  Fetching exact top-up timestamps...`);
      let done = 0;
      for (const { imei, topup, resultIndex } of topupQueries) {
        try {
          const detail = await findTopupTimestamp(imei, topup, year, month);
          detail.boundaryGB = topup.boundaryGB;
          imeiResults[resultIndex].topupDetails.push(detail);
          // Capture org/country from first detail
          if (!imeiResults[resultIndex].org && detail.customer) {
            const orgMatch = detail.customer.match(/@(.+)\.com/);
            imeiResults[resultIndex].org = orgMatch?.[1]?.toUpperCase() || "";
          }
          if (!imeiResults[resultIndex].country && detail.country) {
            imeiResults[resultIndex].country = detail.country;
          }
        } catch (e) {
          console.error(`    Error finding topup time for ${imei} on ${topup.date}: ${e.message}`);
          imeiResults[resultIndex].topupDetails.push({
            timestamp: `${topup.date}T??:??:??`,
            boundaryGB: topup.boundaryGB,
            approximate: true,
          });
        }
        done++;
        if (done % 10 === 0) process.stdout.write(`    ${done}/${totalTopups}\n`);
      }
      console.log(`    Done: ${done}/${totalTopups} timestamps resolved`);
    }

    allMonthData.push({ year, month, monthLabel: label, imeiResults });
  }

  // Phase 4: Generate Excel
  console.log("\n── Generating Excel ──");
  const wb = buildExcel(allMonthData, imeis);
  const outPath = "delme/UNO_SALUD_TopUp_Report.xlsx";
  XLSX.writeFile(wb, outPath);
  console.log(`\nReport saved to: ${outPath}`);

  // Quick summary
  console.log("\n═══ Summary ═══");
  for (const { monthLabel, imeiResults } of allMonthData) {
    const active = imeiResults.filter((r) => r.totalBytes > 0).length;
    const topups = imeiResults.reduce((sum, r) => sum + r.topupDays.length, 0);
    const totalGB = imeiResults.reduce((sum, r) => sum + r.totalBytes, 0) / 1073741824;
    console.log(`  ${monthLabel}: ${active} active devices, ${topups} top-ups, ${totalGB.toFixed(1)} GB total`);
  }
}

main().catch((e) => {
  console.error("Fatal error:", e);
  process.exit(1);
});
