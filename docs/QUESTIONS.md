# TravelWifi Ops — Documentation Questions & Gap Analysis

**Prepared by:** Architect + Senior Data Scientist review of all 21 docs in `/docs/`
**Date:** 2026-04-10
**Format:** Answer inline below each question. Write "N/A" to skip.

---

## 1. External Integrations (Not Documented)

### Zendesk

1. What is the Zendesk instance URL, API version, and authentication method (API token, OAuth, basic auth)?
2. What Zendesk ticket fields map to TravelWifi order data? Is there a custom field for `order_number`, `ICCID`, or `system`?
3. How should the ops tool link a Zendesk ticket to an OpenSearch order — by customer email match, a custom field, or another mechanism?
4. Does the support team use Zendesk views/macros that the ops tool should integrate with?
5. Should the ops tool create/update Zendesk tickets, or only read them?

### Stripe

6. What Stripe API version is in use, and what is the authentication setup?
7. How does a Stripe `payment_intent` or `charge` ID relate to an OpenSearch order? Is there a Stripe reference field in the `orders` index, or only in RDS?
8. Should the ops tool initiate Stripe refunds directly, or go through an internal API?
9. Are there multiple Stripe accounts per brand/system (TWUS, TWEU, TWCL), or one unified account?
10. How are CMRPuntos orders handled in Stripe? The docs say CMR pays monthly — is there no Stripe charge for CMRPuntos orders?
11. What Stripe webhook events does the existing system listen for?

### Mailgun

12. What Mailgun domain and API key configuration is used?
13. What transactional emails does the ops tool need to send (confirmations, refund notifications, activation instructions)?
14. Are there existing Mailgun templates to reuse, or does the ops tool define new ones?
15. Is Mailgun used for inbound email parsing (customer replies routed to support)?

---

## 2. Authentication & Authorization

16. What auth system should the ops tool use (SSO, LDAP, custom JWT)? The 2FA login page is built — does it need to integrate with an existing identity provider?
17. What specific RBAC permissions differ between roles (junior agent, senior agent, supervisor, admin)?
18. How should secrets be managed in production — Vault, AWS Secrets Manager, env vars? The docs contain plaintext credentials in `RENTAL_ESIM_BUNDLE_SYSTEM.md`.
19. Should the ops tool support env-var-based config as an alternative to `config.yaml` for API keys?

---

## 3. OpenSearch Data Gaps

20. **CDR collector desync**: 114K records reported but only 5 exist in OpenSearch (`CDR_INFRASTRUCTURE.md`). Is this fixed? Is CDR data now reliable?
21. **`coupons[]` field**: Only ~14 orders have it (added March 2026). For pre-March orders, should the ops tool query RDS for coupon data? Which table?
22. **Missing fields**: `shipping_total`, `shipping_cost`, `coupon_code`, `factor_type` exist in RDS but not OpenSearch (`WORKLOG.md`). Enrich OpenSearch or query RDS on-demand?
23. **Phone numbers**: Not in any OpenSearch index (`01-opensearch.md`). What system stores them for phone-based lookup?
24. **Three CDR index families** with different schemas: `tellisim-cdr-*`, `logstash-cdr*`, `esim-archive-cdr_*`. Should the ops tool abstract over all three, or only target `tellisim-cdr-read`?
25. **`daily_data_consumption` package IDs** are MongoDB ObjectIds with no name mapping (`ucl_sim_data_flow_analysis.md`). Does a mapping table exist?
26. **Five rental devices** consumed wholesale data with zero entries in `daily_data_consumption`. Known ongoing gap or one-time incident?
27. **Rental/Sapphire orders** are not in the `orders` OpenSearch index — only eSIM/TravelWifi orders (231K records). Where does the ops tool get rental/Sapphire orders?
28. **`order_usd_rate_exchange`** is stored as a `text` field requiring runtime parsing. How many orders have malformed values?

---

## 4. Vendor API Gaps

### TelliSIM

29. Which TelliSIM endpoints beyond `GET /v3/subscriptions/{iccid}/plan-attachments` should the ops tool integrate? Does it need write access (suspend, create, send SMS)?
30. The TelliSIM `suspend` operation is **non-reversible**. What safeguards should the ops tool enforce before a support rep executes it?
31. No TelliSIM rate limit is documented. The current concurrency cap is 10. What are TelliSIM's actual rate limits?
32. No retry logic exists — 5-second timeout returns `state: unknown`. What should the ops tool show during a TelliSIM outage?
33. `plan.name` from TelliSIM does not match internal SKUs. Is there a mapping table?
34. Only the most recent plan attachment is kept — topup investigation needs the full list. Should a new method be added?
35. `state` enum in code doesn't include `SUSPENDED` or `CREATED` which exist in the full API docs. Handle these?
36. No staging/sandbox TelliSIM environment is configured. How does QA test new API integrations?

### uCloudlink / UCL

37. Should the ops tool connect to UCL SFTP directly, or only consume data from `ucl-sim-cdr-*` OpenSearch indices?
38. Documented **77.9% discrepancy** between Excel vendor billing and CDR data for Australia. Trust CDR, trust Excel, or flag discrepancies?
39. UCL CDR has ~2.5–3 hour lag. What is the end-to-end latency from a data session to the ops tool showing it? Is near-real-time possible?
40. UCL CDR delivery is purely pull-based (SFTP poll). What is the contractual polling SLA? Can records arrive out-of-order?

---

## 5. Product Classification & SKU Ambiguities

41. **Adventure tier daily allowance**: `02-products.md` says "smallest" (~2-3 GB/day), `RENTAL_ESIM_BUNDLE_SYSTEM.md` says 1 GB/day. Which is correct?
42. **Voyage tier daily allowance**: Implied 10 GB/day — is this universal across all regions/variants?
43. **Midnight reset timezone for DAILY_DATA**: Is "local time" the device GPS location, customer home timezone, UTC, or destination country?
44. **`FLOW` plans appear in both Rental and Sapphire owner orders** (`SAPPHIRE_PRODUCT_CATEGORIZATION.md` shows `S2GLOCALMERENT + DHI_PL_FLOW30GB15DAYS`). What is the definitive classification rule?
45. **Regional combo SKUs** like `DHI_KW+EU28_45GB_FP_30days` aren't in the main classification decision tree. How should the ops tool classify these?
46. **INSURANCE add-on SKU** appears in rental orders. Display it as a line item or hide it?
47. **FLEX legacy SKUs** (712 active): Are they TOTAL_DATA or DAILY_DATA model? Are they covered by the ops tool?
48. **Discontinued products** (`TW_FLEX_ESIM_MANX`, `Global_eSIMCard`): Listed as discontinued in Jan 2026 docs but active in Nov 2025 docs. Which is correct?

---

## 6. Business Logic

### Fraud Detection

49. What is the complete set of fraud rules? The docs describe >80% consumption before cancel and `threshold_date` signals. Is there a fraud rules engine, or build from scratch?
50. Is consumption after `threshold_date` a hard fraud flag or input to a risk score?
51. Is there a consumption velocity threshold (X GB in Y hours) beyond the 80% rule?
52. For `status = "Fraud"` orders, should the ops tool just display a badge, or trigger automated actions (suspend via TelliSIM, notify team)?
53. The 80% threshold is based on a sample of 1,280 orders. Are utilization benchmarks updated periodically? What is the statistical confidence?
54. CDR has a 3+ hour lag. For customers who request refund and continue using data within the lag window, how does fraud detection handle timing?

### Refunds

55. What is the refund approval workflow? Can the ops tool auto-approve refunds under certain conditions?
56. For CMRPuntos orders, "do not refund based on `total = 0`". Are there other brands with special refund rules?
57. `Partial Refund - 10%` is listed. Are other percentages possible (5%, 25%, 50%)?

### Pricing & GP

58. GP floor is 56% per `02-products.md`, but category margins in `PRODUCT_COMPLETE_GUIDE.md` are 15-45% for many rentals. Which is authoritative?
59. Is GP% computed live from CDR `CUSTO_CHARGE` vs `total_usd`, or pre-computed from a catalog?
60. `CUSTO_CHARGE` is described as USD wholesale cost, but MANX charges are in GBP. Are values pre-converted to USD by TelliSIM, or does the ops tool need FX conversion?
61. Seasonal multipliers (x0.90–x1.25) use calendar months, but tests use PPI buckets. Which system should the ops tool use?

---

## 7. Customer Data Model

62. Is `customer_email` the only cross-system customer identifier? What happens when a customer uses different emails for different orders?
63. For the "unified customer view" across eSIM, Rental, Sapphire — what is the intended data source for Rental/Sapphire orders if they're not in OpenSearch?
64. Rental device-to-customer linkage requires 4-5 RDS table joins. Is there a denormalized view or API?
65. ICCID reuse across customers: does the ops tool show the attribution decision (which order "won") to the support rep?
66. `Cancel` vs `Canceled` spelling inconsistency in status values — should the ops tool normalize these?

---

## 8. CDR & Billing

67. What is the authoritative billing period — calendar month, rolling 30-day from activation, or trip start/end? Does it differ between eSIM and Rental?
68. Adventure2, Voyage3 version suffixes: Are allowances and pricing identical across versions?
69. Overage on TOTAL_DATA: CDR shows completed orders exceeding plan cap (24 GB on 20 GB plan). Is there an automated vendor dispute process?
70. Multi-SIM pooling (one Sapphire IMEI consuming from 6 SIMs): Should the ops tool aggregate across all IMSI sessions per IMEI, or show per-IMSI?
71. `PREPAID_PACKAGE_IDS` in CDR: Are these always human-readable in `tellisim-cdr-read`? Is there a lookup table to map to internal `package_sku`?
72. Two CDR sources for rentals: MANX/VFNL eSIM bundles (`esim-archive-cdr_*`) vs UCL (`ucl-sim-cdr-*`). How does the ops tool determine which to query?

---

## 9. Infrastructure & Deployment

73. What environment does the ops tool target (AWS ECS, Lambda, EC2, Kubernetes)?
74. OpenSearch requires VPN access. Will the ops tool run inside the VPC, or need VPN/tunneling?
75. Is there a staging OpenSearch cluster? The TelliSIM docs note no staging base URL is configured.
76. The docs reference MongoDB for package ID mapping and rental/Sapphire orders. What is the MongoDB connection info and which collections are needed?
77. Two separate RDS references exist — are these the same instance?
78. What populates the `daily_data_consumption_*` OpenSearch index? Which service/pipeline?

---

## 10. Data Retention & Compliance

79. The orders index has indefinite retention. Are there data deletion requirements for customer PII (GDPR)?
80. UCL SFTP CDR files are available for ~8 months. What happens to dispute resolution for older records?

---

## 11. Ops Tool Scope

81. Is the ops tool **replacing** the existing portal (which has `web/app/settings/os-explorer/page.tsx`, API routes like `api/routes/admin.py`), **extending** it, or **building alongside** it?
82. What monitoring/alerting should the ops tool integrate with (CloudWatch, Datadog)?
83. When TelliSIM returns `unknown`, CDR data is missing, or OpenSearch is unreachable — what is the graceful degradation strategy?
84. No KPI is defined for rental fleet utilization (rental days out / days available). Is this needed in the ops tool?
85. CMR Puntos revenue: "month-end" payment — does the ops tool need receivables aging visibility?

---

**Total: 85 questions across 11 categories.**

**Top 3 blockers for development:**
1. Complete absence of Zendesk/Stripe/Mailgun integration specs (Q1-15)
2. Rental/Sapphire orders not in OpenSearch — no documented source for unified customer view (Q27, Q63)
3. Unresolved decision on enriching OpenSearch vs. querying RDS for missing fields (Q22-23)
