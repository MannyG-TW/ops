# Tech Debt

Running list of known gaps, deferred work, and signals we've decided to revisit. Add items with a date and a short evidence trail so the next person understands why the debt exists, not just that it does.

---

## Open

### 1. Plan reconciliation audit job (UCL ↔ OpenSearch CDR)

**Added:** 2026-04-14
**Origin:** Kristin Crouse overage investigation (TWUS-274149, IMEI 358617800210246)

**Problem.** Today the Sapphire device card is a point-in-time read. We have no background job that continuously reconciles UCL plan state against CDR usage to catch real overages or billing leaks.

**What the job should do.**

For each sub-user with an active UCL offer:

1. Query UCL `QueryUserOfferList` (flag=2, all statuses) for the full offer history.
2. For every offer, read `flowByte` (cap) and `surplusFlowbyte` (remaining).
3. Sum CDR `flowsize` from `logstash-cdr*` where `@timestamp` falls in `[effectiveTime, expiryTime]` and the session's `col_2` (UCL customerId) matches the offer's customer.
4. Compare `flowByte - surplusFlowbyte` (UCL-reported consumed) against `sum(flowsize)` (CDR-reported consumed). Delta > N% → flag.
5. Cross-reference with OpenSearch `orders` by email + trip window. An offer whose UCL `orderId=None` **and** no matching order in OpenSearch AND `pkType != CSTC` is a leak candidate.

**Deliverables.**

- New Next.js route handler (or worker process) that runs on a cron — nightly is fine.
- Results table in SQLite (`plan_audit_runs`, `plan_audit_flags`).
- Dashboard page listing flags with severity + evidence links.

**Why deferred.** Needs credentials already in DB (done), needs UCL `QueryUserOfferList` endpoint (done), needs a cron runner (not set up). Ship the UI-side reconciliation view first so operators can catch issues in real time while a customer is on the line.

**Relevant code.**

- `src/app/api/ucl/user-offers/route.ts`
- `src/app/api/opensearch/cdr/route.ts`
- `src/lib/server-credentials.ts`

---

### 2. TelliSIM routes still read credentials from the request body

**Added:** 2026-04-14

Most OpenSearch routes now resolve credentials via `resolveOpenSearchCredentials` (prefers request body, falls back to DB). The TelliSIM routes (`subscription`, `smdp`, `location`, `send-sms`, `suspend`, `operators`, `coverage`) still only accept credentials in the body. Once the Settings UI writes TelliSIM creds to the `tellisim_config` DB table, migrate those routes to `resolveTelliSIMCredentials` for consistency and to unblock server-only jobs that touch TelliSIM.

---

### 3. Legacy `user_code` absent in `logstash-cdr*`

**Added:** 2026-04-14
**Origin:** Kristin Crouse investigation.

The `logstash-cdr*` index does not populate the raw UCL `user_code` field — only a derived `customer` string with the IMEI baked in (e.g. `kristinkcrouse_gmail_com_358617800210246@user-devices.travelwifi.com`). That makes per-user historical aggregation (across device rebinds) painful.

**Fix.** Either (a) add `user_code` to the logstash parser so raw email ships with every CDR, or (b) when investigating a user, resolve their UCL `customerId` once and join on `col_2` instead of `customer`.
