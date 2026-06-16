"use client";

import { useState, useCallback, useRef } from "react";
import {
  Barcode,
  Upload,
  Download,
  AlertCircle,
  CheckCircle,
  Loader2,
  X,
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  BarChart3,
  Activity,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { fetchOS } from "@/lib/settings-client";
import * as XLSX from "xlsx";

// ─── Types ───

interface SkippedImei {
  value: string;
  reason: "invalid" | "duplicate";
}

interface UsageReportData {
  data: Record<string, Record<string, number>>;
  dates: string[];
  totalImeis: number;
  duplicatesRemoved: number;
  warnings?: string[];
  summary: {
    totalBytes: number;
    avgDaysWithUsage: number;
    avgDaysWithoutUsage: number;
  };
}

// ─── Constants ───

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const PAGE_SIZE = 50;

// ─── Helpers ───

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1_073_741_824) return `${(bytes / 1_048_576).toFixed(2)} MB`;
  return `${(bytes / 1_073_741_824).toFixed(2)} GB`;
}

function getMonthLabel(month: number, year: number): string {
  return `${MONTHS[month].slice(0, 3)}${year}`;
}

// ─── Main Page ───

export default function AnalyzerPage() {
  // Input
  const [inputMode, setInputMode] = useState<"single" | "bulk">("single");
  const [singleInput, setSingleInput] = useState("");
  const [bulkInput, setBulkInput] = useState("");
  const [imeis, setImeis] = useState<string[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [duplicateCount, setDuplicateCount] = useState(0);
  const [invalidCount, setInvalidCount] = useState(0);
  const [skippedImeis, setSkippedImeis] = useState<SkippedImei[]>([]);
  const [imeisLoaded, setImeisLoaded] = useState(false);

  // Period config
  const [periodMode, setPeriodMode] = useState<"month" | "range">("month");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [monthEndDate, setMonthEndDate] = useState("");
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [noonToNoon, setNoonToNoon] = useState(true);

  // Progress
  const [generating, setGenerating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMessage, setProgressMessage] = useState("");

  // Results
  const [reportData, setReportData] = useState<UsageReportData | null>(null);
  const [currentPage, setCurrentPage] = useState(0);
  const [imeiFilter, setImeiFilter] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Year options ───
  const currentYear = new Date().getFullYear();
  const yearOptions = [currentYear - 2, currentYear - 1, currentYear];

  // ─── IMEI Validation ───

  const processImeis = useCallback((raw: string) => {
    const lines = raw
      .split(/[\n\r,]+/)
      .map((l) => l.trim())
      .filter(Boolean);

    const errors: string[] = [];
    const valid: string[] = [];
    const skipped: SkippedImei[] = [];
    let dupes = 0;
    let invalid = 0;
    const seen = new Set<string>();

    for (const line of lines) {
      const cleaned = line.replace(/\D/g, "");
      if (cleaned.length !== 15 && cleaned.length !== 16) {
        invalid++;
        skipped.push({ value: line, reason: "invalid" });
        continue;
      }
      if (seen.has(cleaned)) {
        dupes++;
        skipped.push({ value: cleaned, reason: "duplicate" });
        continue;
      }
      seen.add(cleaned);
      valid.push(cleaned);
    }

    if (invalid > 0) {
      errors.push(`${invalid} IMEI(s) skipped — must be 15 or 16 digits`);
    }
    if (dupes > 0) {
      errors.push(`${dupes} duplicate(s) removed`);
    }
    if (valid.length === 0) {
      errors.push("No valid IMEIs found");
    }

    setImeis(valid);
    setValidationErrors(errors);
    setDuplicateCount(dupes);
    setInvalidCount(invalid);
    setSkippedImeis(skipped);
    setImeisLoaded(valid.length > 0);
  }, []);

  // ─── File Upload ───

  const handleFileUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      const isExcel = file.name.endsWith(".xlsx") || file.name.endsWith(".xls");

      if (isExcel) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const data = new Uint8Array(ev.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: "array" });
          const sheet = workbook.Sheets[workbook.SheetNames[0]];
          const rows: string[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false });
          const values = rows.map((row) => String(row[0] || "")).filter(Boolean);
          processImeis(values.join("\n"));
        };
        reader.readAsArrayBuffer(file);
      } else {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          processImeis(text);
        };
        reader.readAsText(file);
      }
    },
    [processImeis]
  );

  // ─── Single IMEI Analysis (quick lookup) ───

  const handleSingleAnalyze = () => {
    const cleaned = singleInput.trim().replace(/\D/g, "");
    if (cleaned.length !== 15 && cleaned.length !== 16) {
      setValidationErrors(["IMEI must be 15 or 16 digits"]);
      return;
    }
    setImeis([cleaned]);
    setImeisLoaded(true);
    setValidationErrors([]);
    setDuplicateCount(0);
    setInvalidCount(0);
  };

  // ─── Generate Report ───

  const handleGenerate = async () => {
    setGenerating(true);
    setProgress(0);
    setProgressMessage("Preparing query...");
    setValidationErrors([]);

    let from: string, to: string;
    if (periodMode === "month") {
      from = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
      if (monthEndDate) {
        to = monthEndDate;
      } else {
        const lastDay = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate();
        to = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      }
    } else {
      from = rangeFrom;
      to = rangeTo;
    }

    if (!from || !to) {
      setValidationErrors(["Please select both start and end dates"]);
      setGenerating(false);
      return;
    }

    try {
      setProgress(10);
      setProgressMessage(`Querying ${imeis.length} IMEIs across ${from} to ${to}${noonToNoon ? " (noon-to-noon)" : ""}...`);

      const result = await fetchOS("/api/opensearch/usage-report", {
        imeis,
        from,
        to,
        noonToNoon,
      });

      if (!result.ok) {
        throw new Error(result.error || "Failed to generate report");
      }

      setProgress(100);
      setProgressMessage("Done!");
      setReportData(result as UsageReportData);
      setCurrentPage(0);
      setImeiFilter("");

      setTimeout(() => setGenerating(false), 400);
    } catch (err) {
      setValidationErrors([(err as Error).message]);
      setGenerating(false);
    }
  };

  // ─── Excel Export (two tabs) ───

  const handleExport = () => {
    if (!reportData) return;

    const { data, dates } = reportData;
    const sortedImeis = Object.keys(data).sort();

    // Sheet 1: Usage data
    const usageRows = sortedImeis.map((imei) => {
      const dateMap = data[imei] || {};
      const row: Record<string, string | number> = { IMEI: imei };
      for (const d of dates) {
        row[d] = Math.round(dateMap[d] || 0);
      }
      return row;
    });
    const ws1 = XLSX.utils.json_to_sheet(usageRows);

    // Sheet 2: Skipped IMEIs
    const skippedRows = skippedImeis.map((s) => ({
      IMEI: s.value,
      Reason: s.reason === "invalid" ? "invalid length" : "duplicate",
    }));
    const ws2 = XLSX.utils.json_to_sheet(
      skippedRows.length > 0 ? skippedRows : [{ IMEI: "(none)", Reason: "" }]
    );

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws1, "Usage");
    XLSX.utils.book_append_sheet(wb, ws2, "Skipped");

    let filename: string;
    if (periodMode === "month") {
      filename = `Bifi_Report_${getMonthLabel(selectedMonth, selectedYear)}.xlsx`;
    } else {
      filename = `Bifi_Report_${rangeFrom}_to_${rangeTo}.xlsx`;
    }

    XLSX.writeFile(wb, filename);
  };

  // ─── Filtering & Pagination ───

  const allSortedImeis = reportData ? Object.keys(reportData.data).sort() : [];
  const filteredImeis = imeiFilter
    ? allSortedImeis.filter((imei) => imei.includes(imeiFilter.trim()))
    : allSortedImeis;
  const totalPages = Math.ceil(filteredImeis.length / PAGE_SIZE);
  const pageImeis = filteredImeis.slice(
    currentPage * PAGE_SIZE,
    (currentPage + 1) * PAGE_SIZE
  );

  // ─── Reset ───

  const handleReset = () => {
    setReportData(null);
    setImeisLoaded(false);
    setImeis([]);
    setValidationErrors([]);
    setSkippedImeis([]);
    setBulkInput("");
    setSingleInput("");
    setImeiFilter("");
    setCurrentPage(0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-[540] text-charcoal">
          IMEI Analyzer
        </h1>
        <p className="mt-1 text-[14px] font-[460] text-muted-foreground">
          Analyze Sapphire device data consumption — single lookup or bulk report
        </p>
      </div>

      {/* Input Section */}
      {!reportData && (
        <Card className="rounded-[16px]">
          <CardHeader>
            <CardTitle className="text-[15px] font-[600]">
              Input IMEIs
            </CardTitle>
            <CardDescription>
              Enter a single IMEI or upload a bulk list (15-16 digits)
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Mode Toggle */}
            <div className="flex items-center gap-1.5 rounded-[8px] border border-border bg-muted p-0.5 w-fit">
              <button
                onClick={() => { setInputMode("single"); setImeisLoaded(false); setImeis([]); setValidationErrors([]); setSkippedImeis([]); }}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] font-[540] transition-colors cursor-pointer ${
                  inputMode === "single"
                    ? "bg-white text-charcoal shadow-sm"
                    : "text-muted-foreground hover:text-charcoal"
                }`}
              >
                Single Entry
              </button>
              <button
                onClick={() => { setInputMode("bulk"); setImeisLoaded(false); setImeis([]); setValidationErrors([]); setSkippedImeis([]); }}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] font-[540] transition-colors cursor-pointer ${
                  inputMode === "bulk"
                    ? "bg-white text-charcoal shadow-sm"
                    : "text-muted-foreground hover:text-charcoal"
                }`}
              >
                Bulk / Upload
              </button>
            </div>

            {/* Single Entry */}
            {inputMode === "single" && !imeisLoaded && (
              <div className="flex items-end gap-3">
                <div className="flex-1 max-w-md">
                  <label className="text-[13px] font-[540] text-charcoal">
                    IMEI
                  </label>
                  <Input
                    placeholder="e.g. 353456789012345"
                    value={singleInput}
                    onChange={(e) => setSingleInput(e.target.value)}
                    className="mt-1.5 rounded-[8px] font-mono"
                  />
                </div>
                <Button
                  className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]"
                  onClick={handleSingleAnalyze}
                >
                  <Barcode className="h-4 w-4" />
                  Load
                </Button>
              </div>
            )}

            {/* Bulk Upload */}
            {inputMode === "bulk" && !imeisLoaded && (
              <div className="space-y-4">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv,.txt,.text"
                  className="hidden"
                  onChange={handleFileUpload}
                />
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="flex cursor-pointer flex-col items-center gap-3 rounded-[8px] border-2 border-dashed border-border bg-muted/30 px-6 py-8 transition-colors hover:border-amethyst/40 hover:bg-muted/50"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[8px] bg-lavender/20">
                    <Upload className="h-6 w-6 text-amethyst" />
                  </div>
                  <div className="text-center">
                    <p className="text-[14px] font-[540] text-charcoal">
                      Click to upload IMEI list
                    </p>
                    <p className="mt-1 text-[12px] font-[460] text-muted-foreground">
                      .xlsx, .csv, or .txt file — one IMEI per row
                    </p>
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute inset-x-0 top-1/2 border-t border-border" />
                  <div className="relative flex justify-center">
                    <span className="bg-white px-3 text-[12px] font-[460] text-muted-foreground">
                      or paste directly
                    </span>
                  </div>
                </div>

                <Textarea
                  placeholder={"867079042147732\n867079040580041\n353116250080691"}
                  value={bulkInput}
                  onChange={(e) => setBulkInput(e.target.value)}
                  className="min-h-[120px] rounded-[8px] font-mono text-[13px]"
                />
                {bulkInput.trim() && (
                  <Button
                    className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]"
                    onClick={() => processImeis(bulkInput)}
                  >
                    <Barcode className="h-4 w-4" />
                    Load IMEIs
                  </Button>
                )}
              </div>
            )}

            {/* IMEI Loaded Confirmation */}
            {imeisLoaded && (
              <div className="flex items-center justify-between rounded-[8px] border border-success/30 bg-success-soft/30 px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-success-soft">
                    <CheckCircle className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <p className="text-[14px] font-[540] text-charcoal">
                      {imeis.length} IMEI{imeis.length !== 1 ? "s" : ""} loaded
                    </p>
                    <p className="text-[12px] font-[460] text-muted-foreground">
                      {duplicateCount > 0 && `${duplicateCount} duplicate(s) removed. `}
                      {invalidCount > 0 && `${invalidCount} invalid skipped.`}
                      {duplicateCount === 0 && invalidCount === 0 && "All entries valid."}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="rounded-[8px] text-[13px]"
                  onClick={() => {
                    setImeisLoaded(false);
                    setImeis([]);
                    setValidationErrors([]);
                  }}
                >
                  Change
                </Button>
              </div>
            )}

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
              <div className="space-y-1.5">
                {validationErrors.map((err, i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 rounded-[8px] bg-fraud-red-soft px-3 py-2 text-[13px] font-[460] text-fraud-red"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    {err}
                  </div>
                ))}
              </div>
            )}

            {/* Skipped IMEIs Detail */}
            {skippedImeis.length > 0 && (
              <div className="rounded-[8px] border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-[13px] font-[540] text-charcoal">
                    Skipped IMEIs
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-[6px] text-[12px]"
                    onClick={() => {
                      const text = skippedImeis
                        .map((s) => `${s.value}\t${s.reason === "invalid" ? "invalid length" : "duplicate"}`)
                        .join("\n");
                      navigator.clipboard.writeText(text);
                    }}
                  >
                    Copy All
                  </Button>
                </div>
                <div className="max-h-[160px] overflow-y-auto rounded-[6px] bg-white border border-border">
                  <table className="w-full">
                    <tbody>
                      {skippedImeis.map((s, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-1.5 font-mono text-[12px] font-[540] text-charcoal select-all">
                            {s.value}
                          </td>
                          <td className="px-3 py-1.5 text-[12px] font-[460] text-muted-foreground text-right whitespace-nowrap">
                            {s.reason === "invalid" ? "invalid length" : "duplicate"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Period & Generate */}
      {imeisLoaded && !reportData && !generating && (
        <Card className="rounded-[16px]">
          <CardHeader>
            <CardTitle className="text-[15px] font-[600]">
              Select Period
            </CardTitle>
            <CardDescription>
              Choose a month or custom date range for the report
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Period Mode Toggle */}
            <div className="flex items-center gap-1.5 rounded-[8px] border border-border bg-muted p-0.5 w-fit">
              <button
                onClick={() => setPeriodMode("month")}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] font-[540] transition-colors cursor-pointer ${
                  periodMode === "month"
                    ? "bg-white text-charcoal shadow-sm"
                    : "text-muted-foreground hover:text-charcoal"
                }`}
              >
                Month
              </button>
              <button
                onClick={() => setPeriodMode("range")}
                className={`rounded-[6px] px-3 py-1.5 text-[13px] font-[540] transition-colors cursor-pointer ${
                  periodMode === "range"
                    ? "bg-white text-charcoal shadow-sm"
                    : "text-muted-foreground hover:text-charcoal"
                }`}
              >
                Date Range
              </button>
            </div>

            {periodMode === "month" ? (
              <div className="space-y-3">
                <div className="flex items-end gap-3">
                  <div>
                    <label className="text-[13px] font-[540] text-charcoal">
                      Month
                    </label>
                    <Select
                      value={String(selectedMonth)}
                      onValueChange={(v) => setSelectedMonth(Number(v))}
                    >
                      <SelectTrigger className="mt-1.5 w-[160px] rounded-[8px]">
                        <span>{MONTHS[selectedMonth]}</span>
                      </SelectTrigger>
                      <SelectContent>
                        {MONTHS.map((m, i) => (
                          <SelectItem key={i} value={String(i)}>
                            {m}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[13px] font-[540] text-charcoal">
                      Year
                    </label>
                    <Select
                      value={String(selectedYear)}
                      onValueChange={(v) => setSelectedYear(Number(v))}
                    >
                      <SelectTrigger className="mt-1.5 w-[110px] rounded-[8px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {yearOptions.map((y) => (
                          <SelectItem key={y} value={String(y)}>
                            {y}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-[13px] font-[540] text-charcoal">
                      End Date
                    </label>
                    <Input
                      type="date"
                      value={monthEndDate}
                      onChange={(e) => setMonthEndDate(e.target.value)}
                      className="mt-1.5 rounded-[8px]"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[8px] text-[12px]"
                    onClick={() => {
                      const lastDay = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0));
                      lastDay.setUTCDate(lastDay.getUTCDate() + 10);
                      const y = lastDay.getUTCFullYear();
                      const m = String(lastDay.getUTCMonth() + 1).padStart(2, "0");
                      const d = String(lastDay.getUTCDate()).padStart(2, "0");
                      setMonthEndDate(`${y}-${m}-${d}`);
                    }}
                  >
                    +10 days after month
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[8px] text-[12px]"
                    onClick={() => setMonthEndDate("")}
                  >
                    Full month only
                  </Button>
                  <span className="text-[12px] font-[460] text-muted-foreground">
                    Or set a custom end date
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-end gap-3">
                <div>
                  <label className="text-[13px] font-[540] text-charcoal">
                    From
                  </label>
                  <Input
                    type="date"
                    value={rangeFrom}
                    onChange={(e) => setRangeFrom(e.target.value)}
                    className="mt-1.5 rounded-[8px]"
                  />
                </div>
                <div>
                  <label className="text-[13px] font-[540] text-charcoal">
                    To
                  </label>
                  <Input
                    type="date"
                    value={rangeTo}
                    onChange={(e) => setRangeTo(e.target.value)}
                    className="mt-1.5 rounded-[8px]"
                  />
                </div>
              </div>
            )}

            {/* Noon-to-Noon Toggle */}
            <div className="flex items-center gap-3">
              <Switch
                id="noon-to-noon"
                checked={noonToNoon}
                onCheckedChange={setNoonToNoon}
              />
              <Label
                htmlFor="noon-to-noon"
                className="text-[13px] font-[460] text-charcoal cursor-pointer"
              >
                Count each day noon-to-noon (12:00 UTC → 12:00 UTC)
              </Label>
            </div>

            {/* Date Range Preview */}
            {periodMode === "month" && (
              <div className="rounded-[8px] bg-lavender/10 px-3 py-2 text-[13px] font-[460] text-muted-foreground">
                <CalendarDays className="mr-1.5 inline h-3.5 w-3.5 text-amethyst" />
                {(() => {
                  const from = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-01`;
                  let to: string;
                  if (monthEndDate) {
                    to = monthEndDate;
                  } else {
                    const lastDay = new Date(Date.UTC(selectedYear, selectedMonth + 1, 0)).getUTCDate();
                    to = `${selectedYear}-${String(selectedMonth + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
                  }
                  return `${from} → ${to}${noonToNoon ? " (noon-to-noon)" : ""}`;
                })()}
              </div>
            )}
            {periodMode === "range" && rangeFrom && rangeTo && (
              <div className="rounded-[8px] bg-lavender/10 px-3 py-2 text-[13px] font-[460] text-muted-foreground">
                <CalendarDays className="mr-1.5 inline h-3.5 w-3.5 text-amethyst" />
                {rangeFrom} → {rangeTo}{noonToNoon ? " (noon-to-noon)" : ""}
              </div>
            )}

            {/* Generate Button */}
            <Button
              className="bg-cream text-charcoal hover:bg-cream-hover rounded-[8px] font-[540]"
              onClick={handleGenerate}
            >
              <BarChart3 className="h-4 w-4" />
              Generate Report
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Generating Progress */}
      {generating && (
        <Card className="rounded-[16px]">
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-8 w-8 animate-spin text-amethyst" />
            <div className="text-center">
              <p className="text-[15px] font-[540] text-charcoal">
                Generating Report
              </p>
              <p className="mt-1 text-[13px] font-[460] text-muted-foreground">
                {progressMessage}
              </p>
            </div>
            <Progress value={progress} className="h-2 w-64" />
            <p className="text-[12px] font-[460] text-muted-foreground">
              {progress}% complete
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {reportData && (
        <div className="space-y-4">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <h2 className="text-[16px] font-[600] text-charcoal">
              Report Results
            </h2>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="rounded-[8px] text-[13px]"
                onClick={handleExport}
              >
                <Download className="h-4 w-4" />
                Export Excel
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={handleReset}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="rounded-[16px]">
              <CardContent className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-lavender/20">
                  <Barcode className="h-5 w-5 text-amethyst" />
                </div>
                <div>
                  <p className="text-[12px] font-[460] text-muted-foreground">
                    Total IMEIs
                  </p>
                  <p className="text-[18px] font-[600] text-charcoal">
                    {reportData.totalImeis.toLocaleString()}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[16px]">
              <CardContent className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-success-soft">
                  <Activity className="h-5 w-5 text-success" />
                </div>
                <div>
                  <p className="text-[12px] font-[460] text-muted-foreground">
                    Total Usage
                  </p>
                  <p className="text-[18px] font-[600] text-charcoal">
                    {formatBytes(reportData.summary.totalBytes)}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[16px]">
              <CardContent className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-lavender/20">
                  <CheckCircle className="h-5 w-5 text-amethyst" />
                </div>
                <div>
                  <p className="text-[12px] font-[460] text-muted-foreground">
                    Avg Days w/ Usage
                  </p>
                  <p className="text-[18px] font-[600] text-charcoal">
                    {reportData.summary.avgDaysWithUsage}
                  </p>
                </div>
              </CardContent>
            </Card>
            <Card className="rounded-[16px]">
              <CardContent className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[8px] bg-fraud-yellow-soft">
                  <AlertCircle className="h-5 w-5 text-fraud-yellow" />
                </div>
                <div>
                  <p className="text-[12px] font-[460] text-muted-foreground">
                    Avg Days w/o Usage
                  </p>
                  <p className="text-[18px] font-[600] text-charcoal">
                    {reportData.summary.avgDaysWithoutUsage}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Warnings */}
          {reportData.warnings && reportData.warnings.length > 0 && (
            <div className="space-y-1.5">
              {reportData.warnings.map((w, i) => (
                <div
                  key={i}
                  className="flex items-center gap-2 rounded-[8px] bg-fraud-yellow-soft px-3 py-2 text-[13px] font-[460] text-fraud-yellow"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {w}
                </div>
              ))}
            </div>
          )}

          {/* Skipped IMEIs (in report view) */}
          {skippedImeis.length > 0 && (
            <Card className="rounded-[16px]">
              <CardHeader className="py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-fraud-yellow" />
                    <CardTitle className="text-[14px] font-[600]">
                      {skippedImeis.length} Skipped IMEI{skippedImeis.length !== 1 ? "s" : ""}
                    </CardTitle>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 rounded-[6px] text-[12px]"
                    onClick={() => {
                      const text = skippedImeis
                        .map((s) => `${s.value}\t${s.reason === "invalid" ? "invalid length" : "duplicate"}`)
                        .join("\n");
                      navigator.clipboard.writeText(text);
                    }}
                  >
                    Copy All
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="max-h-[200px] overflow-y-auto rounded-[8px] border border-border">
                  <table className="w-full">
                    <tbody>
                      {skippedImeis.map((s, i) => (
                        <tr key={i} className="border-b border-border last:border-b-0">
                          <td className="px-3 py-1.5 font-mono text-[12px] font-[540] text-charcoal select-all">
                            {s.value}
                          </td>
                          <td className="px-3 py-1.5 text-[12px] font-[460] text-muted-foreground text-right whitespace-nowrap">
                            {s.reason === "invalid" ? "invalid length" : "duplicate"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Data Table */}
          <Card className="rounded-[16px]">
            <CardHeader className="border-b">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-[14px] font-[600]">
                    Daily Usage by IMEI
                  </CardTitle>
                  <Input
                    placeholder="Filter by IMEI..."
                    value={imeiFilter}
                    onChange={(e) => {
                      setImeiFilter(e.target.value);
                      setCurrentPage(0);
                    }}
                    className="h-8 w-[200px] rounded-[8px] text-[13px] font-mono"
                  />
                </div>
                <div className="flex items-center gap-2 text-[13px] font-[460] text-muted-foreground">
                  <span>
                    Page {currentPage + 1} of {totalPages || 1}
                  </span>
                  <span className="text-[12px]">
                    ({filteredImeis.length}{imeiFilter ? ` of ${allSortedImeis.length}` : ""} IMEIs, {reportData.dates.length} days)
                  </span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="sticky left-0 z-10 bg-white min-w-[160px]">
                        IMEI
                      </TableHead>
                      {reportData.dates.map((d) => (
                        <TableHead
                          key={d}
                          className="min-w-[80px] text-center text-[11px]"
                        >
                          {d.slice(5)}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pageImeis.map((imei) => {
                      const dateMap = reportData.data[imei] || {};
                      return (
                        <TableRow key={imei}>
                          <TableCell className="sticky left-0 z-10 bg-white font-mono text-[12px] font-[540]">
                            {imei}
                          </TableCell>
                          {reportData.dates.map((d) => {
                            const val = dateMap[d] || 0;
                            return (
                              <TableCell
                                key={d}
                                className={`text-center text-[11px] font-[460] ${
                                  val > 0
                                    ? "text-charcoal"
                                    : "text-muted-foreground/40"
                                }`}
                              >
                                {val > 0 ? formatBytes(val) : "0"}
                              </TableCell>
                            );
                          })}
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between border-t px-4 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[8px] text-[13px]"
                    disabled={currentPage === 0}
                    onClick={() => setCurrentPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Previous
                  </Button>
                  <div className="flex items-center gap-1">
                    {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                      let page: number;
                      if (totalPages <= 7) {
                        page = i;
                      } else if (currentPage < 4) {
                        page = i;
                      } else if (currentPage > totalPages - 4) {
                        page = totalPages - 7 + i;
                      } else {
                        page = currentPage - 3 + i;
                      }
                      return (
                        <button
                          key={page}
                          onClick={() => setCurrentPage(page)}
                          className={`h-8 w-8 rounded-[6px] text-[13px] font-[540] transition-colors cursor-pointer ${
                            currentPage === page
                              ? "bg-amethyst text-white"
                              : "text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          {page + 1}
                        </button>
                      );
                    })}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-[8px] text-[13px]"
                    disabled={currentPage >= totalPages - 1}
                    onClick={() => setCurrentPage((p) => p + 1)}
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
