/**
 * Import an Omnisend contacts CSV export into marketing_contacts.
 * Full replace per import. Joined onto purchasers by email at query time.
 */

import { readFileSync } from "fs";
import { db } from "@/lib/db";
import { marketingContacts, marketingSyncState } from "@/lib/db/schema";
import type { InsertMarketingContact } from "@/lib/db/schema";

// Quote-aware CSV parse (commas + newlines inside quotes, "" escapes).
function parseCsv(text: string, onRecord: (fields: string[]) => void): void {
  let field = "", inQ = false;
  let row: string[] = [];
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); onRecord(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); onRecord(row); }
}

export interface ImportResult { contacts: number; rows: number; }

export function importOmnisendFile(filePath: string): ImportResult {
  const text = readFileSync(filePath, "utf8");

  let header: string[] | null = null;
  const idx: Record<string, number> = {};
  const get = (r: string[], name: string) => (idx[name] != null ? (r[idx[name]] || "").trim() : "");

  const byEmail = new Map<string, InsertMarketingContact>();
  let rows = 0;
  const now = new Date();

  parseCsv(text, (r) => {
    if (!header) {
      header = r.map((h) => h.trim());
      header.forEach((h, i) => { idx[h] = i; });
      return;
    }
    const email = get(r, "Email").toLowerCase();
    if (!email || !email.includes("@")) return;
    rows++;
    const rec: InsertMarketingContact = {
      email,
      firstName: get(r, "First name"),
      lastName: get(r, "Last name"),
      phone: get(r, "Phone number"),
      emailStatus: get(r, "Email subscription status"),
      emailConsent: get(r, "Email consent"),
      optIn: get(r, "Email opt-in date"),
      smsStatus: get(r, "SMS subscription status"),
      city: get(r, "City"),
      state: get(r, "State"),
      country: get(r, "Country"),
      tags: get(r, "Tags"),
      segments: get(r, "Segments"),
      importedAt: now,
    };
    const prev = byEmail.get(email);
    if (!prev) { byEmail.set(email, rec); return; }
    if (rec.emailStatus === "Unsubscribed") prev.emailStatus = "Unsubscribed"; // conservative
    for (const k of Object.keys(rec) as (keyof InsertMarketingContact)[]) {
      if (!prev[k] && rec[k]) (prev[k] as string) = rec[k] as string;
    }
  });

  const all = [...byEmail.values()];
  db.transaction((tx) => {
    tx.delete(marketingContacts).run();
    for (let i = 0; i < all.length; i += 500) {
      tx.insert(marketingContacts).values(all.slice(i, i + 500)).run();
    }
    tx.insert(marketingSyncState)
      .values({ id: "default", omnisendImportedAt: now, omnisendContacts: all.length })
      .onConflictDoUpdate({
        target: marketingSyncState.id,
        set: { omnisendImportedAt: now, omnisendContacts: all.length },
      })
      .run();
  });

  return { contacts: all.length, rows };
}
