/**
 * Exclusion rules for the marketing console — DB-backed (excluded_domains,
 * excluded_names). On first use the lists are seeded from the legacy
 * scripts/marketing-export-exclusions.json so nothing is lost in the migration.
 */

import { readFileSync } from "fs";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "@/lib/db";
import { excludedDomains, excludedNames } from "@/lib/db/schema";
import type { SelectExcludedDomain, SelectExcludedName } from "@/lib/db/schema";
import { nameTokens, expandVariants, normalizeName } from "./names";

/** Seed both lists from the JSON file the first time (only if both are empty). */
export function seedExclusionsIfEmpty(): void {
  const dCount = db.select().from(excludedDomains).all().length;
  const nCount = db.select().from(excludedNames).all().length;
  if (dCount > 0 || nCount > 0) return;

  let seed: { domains?: string[]; names?: string[] } = {};
  try {
    seed = JSON.parse(readFileSync(path.join(process.cwd(), "scripts", "marketing-export-exclusions.json"), "utf8"));
  } catch {
    seed = {
      domains: ["travelwifi.com", "mynavimo.com", "sapphirego.com", "dhitelecom.com"],
      names: ["Wallace Davis", "Alex Bermudez"],
    };
  }
  const now = new Date();
  for (const d of seed.domains ?? []) {
    db.insert(excludedDomains)
      .values({ id: randomUUID(), domain: d.toLowerCase().trim(), note: "seeded", createdAt: now, createdBy: "system" })
      .onConflictDoNothing()
      .run();
  }
  for (const n of seed.names ?? []) {
    db.insert(excludedNames)
      .values({ id: randomUUID(), name: n.trim(), note: "seeded", createdAt: now, createdBy: "system" }).run();
  }
}

export function getExclusions(): { domains: SelectExcludedDomain[]; names: SelectExcludedName[] } {
  seedExclusionsIfEmpty();
  return {
    domains: db.select().from(excludedDomains).all(),
    names: db.select().from(excludedNames).all(),
  };
}

export interface ExclusionMatcher {
  /** Returns a reason ("domain: x" / "name: y") if excluded, else "". */
  reason(email: string, name: string): string;
}

/** Build a matcher from the current rule sets (so callers reuse one per export). */
export function buildMatcher(
  domains: { domain: string }[],
  names: { name: string }[],
): ExclusionMatcher {
  const domainSet = new Set(domains.map((d) => d.domain.toLowerCase().trim()));
  const nameRules = names.map((n) => ({ label: n.name, tokens: nameTokens(n.name) }));

  return {
    reason(email: string, name: string): string {
      const domain = (String(email).split("@")[1] || "").toLowerCase();
      if (domainSet.has(domain)) return `domain: ${domain}`;
      if (nameRules.length) {
        const local = (String(email).split("@")[0] || "").replace(/[._\-+]+/g, " ");
        const words = new Set(normalizeName(`${name} ${local}`).split(" ").filter(Boolean));
        for (const rule of nameRules) {
          if (!rule.tokens.length) continue;
          const hitsAll = rule.tokens.every((t) => {
            if (words.has(t)) return true;
            for (const v of expandVariants(t)) if (words.has(v)) return true;
            return [...words].some((w) => w.startsWith(t));
          });
          if (hitsAll) return `name: ${rule.label}`;
        }
      }
      return "";
    },
  };
}
