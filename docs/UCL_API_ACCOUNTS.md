# UCL API Account Model

Reference for how uCloudLink (GlocalMe) API credentials are structured for TravelWifi.

**Sources:**
- uCloudLink Interface Specification v2.9 (`docs/UCL_API.pdf`), § 3.2 and § 4.1
- Working PHP proxy (legacy `UclController.php`) — production reference implementation
- YK (GlocalMe) chat 2026-04-14 (partial — see "Notes" below)

---

## Tenancy model

UCL uses **single partner tenancy**. All requests authenticate as the **DHI** partner. Per-org isolation happens one layer up, at the business-customer login layer.

| Field | Scope | Value |
|---|---|---|
| `partnerCode` | Global / shared | `DHI` |
| `mvnoCode` | Global / shared | `DHI` |
| `clientId` | Global / shared (OAuth app cred) | one value, set in UCL Global Config |
| `clientSecret` | Global / shared (OAuth app cred) | one value, set in UCL Global Config |
| `userCode` | **Per-org** | each org's username from `ucl_orgs` |
| `password` | **Per-org** | each org's password from `ucl_orgs` — **MD5-hashed once before sending** |

UCL sees every request as coming from `DHI`. The org distinction (Sapphire, DHI-B2B-Qatar, etc.) is internal to TravelWifi and visible to UCL only through which business-customer account (`userCode`) was used to log in.

---

## GrpUserLogin payload (per spec § 4.1.3)

```jsonc
POST https://saas.ucloudlink.com/bss/grp/noauth/GrpUserLogin

{
  "streamNo":     "TWOPS<yyyyMMddHHmmss><6-digit seq>",   // Char(25), 5-char prefix + 14 digits + 6 digits
  "partnerCode":  "DHI",
  "clientId":     "<from UCL Global Config>",
  "clientSecret": "<from UCL Global Config>",
  "userCode":     "<org.username>",                       // e.g. "Sapphire", "DHIB2BQatar"
  "password":     "<md5(org.password)>",                  // 32-char hex MD5 — REQUIRED, not plaintext
  "mvnoCode":     "DHI",
  "langType":     "en-US"
}
```

### Successful response
```jsonc
{
  "resultCode": "00000000",
  "data": {
    "accessToken": "TGT-...",
    "userId":      "..."
  }
}
```

### Result codes (subset, spec § 3.2.7)
| Code | Meaning |
|---|---|
| `00000000` | Success |
| `00000002` | partnerCode is null |
| `00000004` | partnerCode does not exist |
| `00000005` | loginCustomerId does not exist |
| `00000007` | accessToken is expire |
| `00000009` | clientId is null |
| `00000011` | clientid does not exist |

---

## GrpUserLogout payload (spec § 4.2.3)

```jsonc
POST https://saas.ucloudlink.com/bss/grp/user/GrpUserLogout?access_token=<token>

{
  "streamNo":         "...",
  "partnerCode":      "DHI",
  "loginCustomerId":  "<userId from login response>",
  "langType":         "en-US"
}
```

Tokens are valid for ~8 hours; logout is a courtesy cleanup.

---

## Storage in our DB

| Table | Columns used | Notes |
|---|---|---|
| `ucl_global_config` (singleton, id=`default`) | `partner_code`, `mvno_code`, `client_id`, `client_secret` | All four hardcoded to `DHI`/shared OAuth pair |
| `ucl_orgs` (one row per org) | `org_name` (display), `username` (= UCL userCode), `password` (plaintext, MD5'd at request time) | `is_active`, `last_tested_*` for ops UI |

---

## Notes & gotchas

- **Password is hashed at request time, stored plaintext.** The DB stores plaintext; the request handler MD5s it (`createHash("md5")`). Don't double-hash.
- **`clientId`/`clientSecret` are tenant-bound.** The OAuth-app pair determines which set of business-customer accounts (orgs) you can authenticate. Using a clientId from a different UCL partner tenant returns `01131027 — Login failed. The user is unauthorized.` even when the partnerCode and userCode/password are valid.
  - **The legacy PHP proxy** (`UclController.php`) uses the production-registered pair that has access to all our org users. That pair is what's currently saved in the `ucl_global_config` row. If `01131027` errors come back across the board, the global config may have been swapped to a non-production tenant pair.
  - **YK's chat-shared pair** (`b3dd0bd0-...`) was a *different* test tenant and only authenticates accounts under that tenant — not Sapphire/etc.
- **YK's "partnerCode = ORG" claim was wrong** for our integration. The working PHP proxy uses `partnerCode=DHI` universally. Possibly applies to a different/newer multi-partner setup, or a misunderstanding. Confirm before introducing per-org partnerCodes.
- **`streamNo` format:** 5-char code prefix + 14-digit timestamp (`yyyyMMddHHmmss`) + 6-digit sequence = 25 chars total. We use prefix `TWOPS`.
- **MVNO Code** is constant `DHI` and should be hardcoded/defaulted; not user-editable.
- **Test endpoint:** `POST /api/ucl/test-connection` with `{ orgId, username, password }` runs a real GrpUserLogin and immediately logs out.
- **Test All:** Settings → UCL Organizations → "Test All" button runs the test sequentially for every `is_active` org and writes each result to `last_tested_*`. Sequential (not parallel) to avoid hammering UCL.

## Common result codes seen in practice

| Code | Meaning | Cause we've seen |
|---|---|---|
| `00000000` | Success | Login OK |
| `00000004` | partnerCode does not exist | Sent something other than `DHI` (e.g. an org's username) as partnerCode |
| `01131027` | Login failed. The user is unauthorized | clientId/clientSecret pair doesn't have access to that org's user account — wrong UCL partner tenant |

