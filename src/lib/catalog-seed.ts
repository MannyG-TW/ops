/**
 * Seeds plan catalog data from static JSON files into localStorage.
 * Only runs if no catalog data exists in localStorage yet.
 * Called once on app initialization.
 */

import { saveCatalog, loadCatalog } from "./plan-catalog";

// Dynamic imports for the static JSON files
export async function seedCatalogIfEmpty() {
  if (typeof window === "undefined") return;

  const types = ["local", "regional", "global"] as const;
  let needsSeed = false;

  for (const t of types) {
    if (!loadCatalog(t)) {
      needsSeed = true;
      break;
    }
  }

  if (!needsSeed) return;

  try {
    // Fetch the static files from the public folder
    const [localRes, regionalRes, globalRes] = await Promise.allSettled([
      fetch("/data/connect_local_plan_production.json").then(r => r.json()),
      fetch("/data/connect_regional_plan_production.json").then(r => r.json()),
      fetch("/data/connect_global_plan_production.json").then(r => r.json()),
    ]);

    if (localRes.status === "fulfilled" && !loadCatalog("local")) {
      saveCatalog("local", localRes.value);
    }
    if (regionalRes.status === "fulfilled" && !loadCatalog("regional")) {
      saveCatalog("regional", regionalRes.value);
    }
    if (globalRes.status === "fulfilled" && !loadCatalog("global")) {
      saveCatalog("global", globalRes.value);
    }
  } catch {
    // Silent failure — seed is best-effort
  }
}
