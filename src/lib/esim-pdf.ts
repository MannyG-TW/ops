/**
 * Branded eSIM activation PDF — a customer-facing one-pager an agent can download
 * and send when someone has trouble installing their eSIM. Contains the QR code,
 * plan details, the LPA activation string for manual entry, and install steps.
 *
 * jsPDF is imported lazily inside the function so it never ships in the initial
 * bundle and never runs during SSR.
 */

export interface EsimPdfOptions {
  /** PNG data URL of the QR code (render a high-res QRCodeCanvas and call toDataURL). */
  qrDataUrl: string;
  /** LPA activation string, e.g. "LPA:1$smdp.io$K2-..." */
  lpa: string;
  iccid?: string;
  planName?: string;
  /** Pre-formatted, e.g. "1 GB". */
  dataLabel?: string;
  /** Pre-formatted, e.g. "7 days". */
  validityLabel?: string;
  /** Country / region name, e.g. "Peru". */
  countryLabel?: string;
  /** ISO date or display string. */
  activatedOn?: string;
  /** ISO date or display string. */
  expiresOn?: string;
  /** Customer-facing brand name shown in the header/footer, e.g. "Navimo". */
  brand?: string;
  /** Download file name (without extension). */
  fileName?: string;
}

// Brand palette (globals.css) as RGB tuples for jsPDF.
const MYSTERIA: [number, number, number] = [27, 25, 56];
const AMETHYST: [number, number, number] = [113, 76, 182];
const CHARCOAL: [number, number, number] = [41, 40, 39];
const LAVENDER: [number, number, number] = [203, 183, 251];
const PARCHMENT: [number, number, number] = [220, 215, 211];
const CREAM: [number, number, number] = [233, 229, 221];
const MUTED: [number, number, number] = [120, 116, 110];
const WHITE: [number, number, number] = [255, 255, 255];

function fmtDate(val?: string): string {
  if (!val) return "";
  const d = new Date(val);
  if (isNaN(d.getTime())) return val;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export async function generateEsimActivationPdf(opts: EsimPdfOptions): Promise<void> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });

  const PAGE_W = 210;
  const M = 16; // page margin
  const brand = opts.brand || "TravelWifi";

  // ── Header band ──
  doc.setFillColor(...MYSTERIA);
  doc.rect(0, 0, PAGE_W, 34, "F");
  doc.setTextColor(...LAVENDER);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text(brand.toUpperCase(), M, 13, { charSpace: 1.4 });
  doc.setTextColor(...WHITE);
  doc.setFontSize(20);
  doc.text("eSIM Activation", M, 24);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(...CREAM);
  doc.setFontSize(9.5);
  doc.text("Scan the QR code below to install your travel data plan.", M, 30.5);

  // ── QR card (left) ──
  const qrCardX = M;
  const qrCardY = 44;
  const qrCardW = 60;
  const qrCardH = 60;
  doc.setFillColor(...WHITE);
  doc.setDrawColor(...PARCHMENT);
  doc.setLineWidth(0.4);
  doc.roundedRect(qrCardX, qrCardY, qrCardW, qrCardH, 4, 4, "FD");
  const qrSize = 48;
  const qrX = qrCardX + (qrCardW - qrSize) / 2;
  const qrY = qrCardY + (qrCardH - qrSize) / 2;
  try {
    doc.addImage(opts.qrDataUrl, "PNG", qrX, qrY, qrSize, qrSize);
  } catch {
    /* if the QR image fails, the manual code below still works */
  }

  // ── Plan details (right of QR) ──
  const colX = qrCardX + qrCardW + 12; // 88
  doc.setTextColor(...AMETHYST);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("Y O U R   P L A N", colX, qrCardY + 5);

  const fields: Array<[string, string]> = [];
  if (opts.planName) fields.push(["Plan", opts.planName]);
  if (opts.dataLabel) fields.push(["Data", opts.dataLabel]);
  if (opts.validityLabel) fields.push(["Validity", opts.validityLabel]);
  if (opts.countryLabel) fields.push(["Country", opts.countryLabel]);
  if (opts.expiresOn) fields.push(["Expires", fmtDate(opts.expiresOn)]);
  if (opts.activatedOn) fields.push(["Activated", fmtDate(opts.activatedOn)]);

  let fy = qrCardY + 13;
  for (const [label, value] of fields) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label.toUpperCase(), colX, fy);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...CHARCOAL);
    const v = doc.splitTextToSize(value, PAGE_W - M - colX);
    doc.text(v[0], colX, fy + 5);
    fy += 13.5;
  }

  // ICCID — full width under the cards (mono, easy to read aloud)
  let y = Math.max(qrCardY + qrCardH, fy) + 6;
  if (opts.iccid) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("ICCID", M, y);
    doc.setFont("courier", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...CHARCOAL);
    doc.text(opts.iccid, M + 18, y);
    y += 8;
  }

  // ── Divider ──
  doc.setDrawColor(...PARCHMENT);
  doc.setLineWidth(0.4);
  doc.line(M, y, PAGE_W - M, y);
  y += 10;

  // ── How to install ──
  doc.setFillColor(...AMETHYST);
  doc.rect(M, y - 4, 1.6, 6, "F"); // accent bar
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(...CHARCOAL);
  doc.text("How to install", M + 5, y);
  y += 8;

  const steps = [
    "Connect your phone to Wi-Fi.",
    "Open Settings, then Cellular / Mobile Data, then Add eSIM (Add Cellular Plan).",
    'Choose "Use QR Code" and scan the code above. Can\'t scan? Pick "Enter Details Manually" and paste the activation code below.',
    'Follow the prompts to add the plan, then label the line (for example, "Travel").',
    "When you arrive at your destination, turn ON Data Roaming for this eSIM line.",
  ];
  doc.setFontSize(10.5);
  steps.forEach((step, i) => {
    // number badge
    doc.setFillColor(...LAVENDER);
    doc.circle(M + 2.4, y - 1.4, 2.6, "F");
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...MYSTERIA);
    doc.setFontSize(9);
    doc.text(String(i + 1), M + 2.4, y - 0.2, { align: "center" });
    // step text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10.5);
    doc.setTextColor(...CHARCOAL);
    const lines = doc.splitTextToSize(step, PAGE_W - M - (M + 8));
    doc.text(lines, M + 8, y);
    y += lines.length * 5.4 + 3.4;
  });

  // ── Manual activation code box ──
  y += 2;
  const boxH = 18;
  doc.setFillColor(...CREAM);
  doc.roundedRect(M, y, PAGE_W - 2 * M, boxH, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...MUTED);
  doc.text("ACTIVATION CODE (MANUAL ENTRY)", M + 5, y + 6.5);
  doc.setFont("courier", "normal");
  doc.setFontSize(11);
  doc.setTextColor(...CHARCOAL);
  const lpaLines = doc.splitTextToSize(opts.lpa, PAGE_W - 2 * M - 10);
  doc.text(lpaLines, M + 5, y + 12.5);
  y += boxH + 10;

  // ── Footer ──
  const footerY = 285;
  doc.setDrawColor(...PARCHMENT);
  doc.setLineWidth(0.4);
  doc.line(M, footerY - 6, PAGE_W - M, footerY - 6);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(...MUTED);
  doc.text(
    `Need help? Reply to your ${brand} order confirmation email and our support team will assist you.`,
    M,
    footerY
  );

  const safeName = (opts.fileName || `eSIM-Activation-${opts.iccid || "plan"}`).replace(/[^\w.-]+/g, "-");
  doc.save(`${safeName}.pdf`);
}
