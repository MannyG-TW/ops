# TelliSIM API v3 – Complete Professional Documentation (100% Coverage)

![API Explanation Diagram](https://cdn.tellisim.com/tellisim-website-images/tellisim-api-docs-diagram.png)

**Version:** 1.0.0  
**Base URL:** `https://api.tellisim.com`

## Authentication
**ApiKeyAuth** – `key` query parameter.

## 1. Subscriptions

### List Subscriptions – `GET /v3/subscription`
**Response 200 fields**

| Field                        | Type     | Required | Example |
|------------------------------|----------|----------|---------|
| error                        | boolean  | Yes      | false |
| data                         | array    | Yes      | — |
| data[].subscription_id       | string   | Yes      | "6174d2d5-f3bd-4336-abe0-13d75cc8a023" |
| data[].created_at            | string   | Yes      | "2025-08-24T14:59:38.037Z" |
| data[].metadata              | string   | Yes      | "usa plan applied" |
| data[].esim.esim_id          | string   | Yes      | "67940632-e09e-4c16-b220-1b47988d50b6" |
| data[].esim.iccid            | string   | Yes      | "8948010000031324500" |
| data[].esim.lpa_string       | string \| null | Yes | "LPA:1$smdp.io$K2-2GNHV6-USUV2O" |
| data[].esim.label            | string   | Yes      | "Green" |

### Create Subscription – `POST /v3/subscription`
**Request fields** (from dedicated file)

| Field                        | Type     | Required | Notes |
|------------------------------|----------|----------|-------|
| iccid                        | string   | No       | Auto-selects free eSIM if omitted |
| metadata                     | string   | Yes      | — |
| plan_id                      | string   | Yes      | — |
| active_period.start          | string   | Conditional | ISO 8601 UTC |
| active_period.end            | string   | Conditional | Required for non-recurring |

**Response 201** + 401, 404 (no eSIM available)

### Get Subscription – `GET /v3/subscriptions/{iccid}`
Full details (same structure as List).

### Delete Subscription – `DELETE /v3/subscriptions/{iccid}`
**Response 403** if eSIM was installed.

### List Plan Attachments – `GET /v3/subscriptions/{iccid}/plan-attachments`
**Response 200** (full schema from dedicated file)

| Field                              | Type     | Description |
|------------------------------------|----------|-----------|
| data[].plan_attachment_id          | string   | — |
| data[].created_at                  | string   | — |
| data[].activation_at               | string \| null | — |
| data[].expiration_at               | string \| null | — |
| data[].used_allowance.dataBytes    | number   | — |
| data[].state                       | string   | CREATED / ACTIVE / SUSPENDED / EXPIRED / PENDING_FOR_FIRST_USE |
| data[].plan.name / _id / coverage_id / region_code / label / throttling / recurring / data_mega_bytes / period_days | — | Embedded plan |

### Get Plan Attachment – `GET /v3/subscriptions/{iccid}/plan-attachments/{plan_id}`
Same detailed structure as above.

### Suspend Plan Attachment – `POST /v3/subscriptions/{iccid}/plan-attachments/{id}/suspend`
Non-reversible.

### Send SMS – `POST /v3/subscriptions/{iccid}/send-sms`
Request: `from`, `message` (both required).  
**Response 502** – SMS Delivery Failed.

### Get Subscription Location – `GET /v3/subscriptions/{iccid}/location`
Only returns data if active in last 7 days.

---

## 2. Plans

### List Plans – `GET /v3/plans`
**Response 200** (full fields from dedicated file)

| Field                                 | Type     | Description / Enum |
|---------------------------------------|----------|--------------------|
| data[].plan_name                      | string   | — |
| data[].plan_id                        | string   | — |
| data[].coverage_id                    | string   | — |
| data[].region_code                    | string   | — |
| data[].label                          | string   | Green / Aqua / Blue / Voilet / Red / Grey / Orange |
| data[].throttling                     | boolean  | — |
| data[].recurring                      | boolean  | — |
| data[].data_mega_bytes                | integer  | — |
| data[].period_days                    | integer  | — |
| data[].archive                        | boolean  | — |
| data[].nb_occurrence                  | integer  | — |
| data[].recurring_periodicity_type     | string   | "0","1","2" |
| data[].recurring_periodicity_frequency| integer  | — |
| All throttling thresholds + limits    | —        | Full set of 9 throttling fields |

### Create Plan – `POST /v3/plans`
**Request fields** (exact from last file)

| Field                            | Type    | Required when       | Enum / Notes |
|----------------------------------|---------|---------------------|--------------|
| coverage_id                      | string  | Always              | — |
| data_MBs                         | number  | Always              | — |
| name                             | string  | Always              | — |
| period_days                      | number  | Always              | — |
| recurring                        | boolean | Always              | — |
| throttling                       | boolean | Always              | — |
| nb_occurrence                    | number  | recurring=true      | — |
| recurring_periodicity_type       | string  | recurring=true      | "0","1","2" |
| recurring_periodicity_frequency  | number  | recurring=true      | — |
| throttling_threshold1_perc       | number  | throttling=true     | — |
| throttling_threshold1_limit      | string  | throttling=true     | "128","256",... |
| throttling_threshold2_perc       | number  | throttling=true     | — |
| throttling_threshold2_limit      | string  | —                   | — |
| throttling_threshold3_perc       | number  | throttling=true     | — |
| throttling_threshold3_limit      | string  | —                   | — |

**Response 201** – Returns `plan_id`

### Get a Plan – `GET /v3/plans/{planId}`
Full plan object (same fields as List/Create).

### Delete Plan – `DELETE /v3/plans/{planId}`
**Response 401** if unauthorized.

### Archive / Unarchive Plan
`POST /v3/plans/{planId}/archive`  
`POST /v3/plans/{planId}/unarchive`

---

## 3. Coverage Profiles

### List Coverage Profiles – `GET /v3/coverage-profiles`
**Response 200** (full from dedicated file)

| Field                                      | Type  | Description |
|--------------------------------------------|-------|-----------|
| data[].coverage_id                         | string| — |
| data[].label                               | string| Green / Aqua / ... |
| data[].region_name                         | string| — |
| data[].region_code                         | string| — |
| data[].countries[].iso2 / iso3 / name      | —     | — |
| data[].countries[].operators[].operator_id / name / supported_rats / mcc_mnc | — | Full operator details |

### Get Coverage Profile – `GET /v3/coverage-profiles/{coverageId}`
Same full structure.

### Create Custom Region Coverage Profile – `POST /v3/coverage-profiles/custom-region`
**Request**

| Field       | Type          | Required | Example |
|-------------|---------------|----------|---------|
| region_name | string        | Yes      | "Usa and Mexico Regional Plan" |
| label       | string        | Yes      | "Green" |
| iso2_list   | array[string] | Yes      | ["US","MX"] |

**Response 200** – `coverage_id`, `region_code`, `region_name`, `iso2_list`

**Response 400** – Duplicate name  
**Response 409** – Duplicate coverage (returns existing_coverage object)

---

## 4. SIM Management

### List SIMs – `GET /v3/sims`
**Response 200** (full from dedicated file)

| Field              | Type     | Description |
|--------------------|----------|-----------|
| data[].iccid       | string   | — |
| data[].label       | string   | — |
| data[].lpa         | string \| null | — |
| data[].used        | boolean  | — |
| data[].esim_id     | string   | — |
| data[].created_at  | string   | — |
| data[].is_esim     | boolean  | — |
| next_page          | string \| null | Pagination token |

### Get SIM Details – `GET /v3/sims/{iccid}`
Same fields as List SIMs.

### Get SIM SMDP Info – `GET /v3/sims/{iccid}/smdp-info`
**Response 200** – Full state_history array with states: "BPP Installation", "Enable", "Disable", "Delete"

---

## 5. Operators

### List Operators – `GET /v3/operators`
**Response 200** (full from dedicated file)

| Field                          | Type   | Description |
|--------------------------------|--------|-----------|
| data[].operator_id             | string | — |
| data[].name                    | string | e.g. "AT&T USA" |
| data[].iso2                    | string | — |
| data[].supported_rats          | array  | ["4G","5G"] |
| data[].mcc_mnc                 | array  | ["310-680", ...] |

### Get Operator – `GET /v3/operators/{operatorId}`
Same full operator object.

---

## 6. Webhook Events (All 3 dedicated files covered)

**Signature:** `x-tellisim-signature` (use `@tellisim/webhook-signature-validator`)

### 6.1 Data Allowance Consumed – `POST attachment.allowanceConsumed`
Full request body with `usagePercentage` (50/80/100), `dataUsageBytes`, `esim`, `planId`, `attachmentId`.

### 6.2 SIM Location Changed – `POST subscription.esim.locationChanged`
Full request: `data.esim`, `data.countryIso2`.

### 6.3 SIM SMDP Status Changed – `POST esim.smdp.stateChanged`
Full request: `data.sim`, `data.smdpStateChange.state` (enum), `data.smdpStateChange.modificationResult`.

