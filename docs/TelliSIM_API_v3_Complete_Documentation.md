# TelliSIM API v3 - Complete Documentation

**Version:** 1.0.0

![API explanation diagram](https://cdn.tellisim.com/tellisim-website-images/tellisim-api-docs-diagram.png)

---

## Servers

**Production server:**
```
https://api.tellisim.com
```

---

## Security

### ApiKeyAuth

Your API key for authentication

| Property | Value |
|----------|-------|
| Type | apiKey |
| In | query |
| Name | key |

---

# Subscriptions

Operations related to subscriptions.

---

## List Subscriptions

This endpoint allows users to retrieve subscription details associated with the SIM service. It provides information about the subscription, including its ID, creation date, associated metadata, and SIM details.

**Endpoint:** `GET /v3/subscription`  
**Security:** ApiKeyAuth

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether there was an error in the request | |
| `data` | array | ✓ | Contains an array of subscription objects | |
| `data.subscription_id` | string | ✓ | The unique identifier for the subscription | `"6174d2d5-f3bd-4336-abe0-13d75cc8a023"` |
| `data.created_at` | string | ✓ | The timestamp when the subscription was created | `"2025-08-24T14:59:38.037Z"` |
| `data.metadata` | string | ✓ | Additional metadata related to the subscription | `"usa plan applied"` |
| `data.esim` | object | ✓ | eSIM details object | |
| `data.esim.esim_id` | string | ✓ | The unique identifier for the eSIM | `"67940632-e09e-4c16-b220-1b47988d50b6"` |
| `data.esim.iccid` | string | ✓ | The Integrated Circuit Card Identifier for the eSIM | `"8948010000031324500"` |
| `data.esim.lpa_string` | string/null | | The LPA string associated with the eSIM if it is an eSIM else null | `"LPA:1$smdp.io$K2-2GNHV6-USUV2O"` |
| `data.esim.label` | string | ✓ | A label for the eSIM | `"Green"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Create Subscriptions

This endpoint allows users to create a new subscription for a SIM. By sending a POST request to the specified URL, users can initiate the subscription process with the necessary parameters.

The optional `active_period` field controls when the subscription becomes active and (optionally) when it expires.

**Endpoint:** `POST /v3/subscription`  
**Security:** ApiKeyAuth

### Request Body (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `iccid` | string | | ICCID of the SIM (eSIM or Physical SIM). If not provided, the API will automatically select a free eSIM for the specified plan label. If no free eSIM is available for that label, a 404 error will be returned. | `"8948010000031324502"` |
| `metadata` | string | ✓ | Metadata for the subscription | `"usa recurring plan"` |
| `plan_id` | string | ✓ | The plan identifier | `"0a3ee1d6-fe5e-4561-91a0-d4649aaf0754"` |
| `active_period` | object/null | | Optional activation window for the subscription | |
| `active_period.start` | string | | Desired activation start time (ISO 8601, UTC) | `"2025-12-10T15:03:28.533603"` |
| `active_period.end` | string/null | | Desired expiration time (ISO 8601, UTC) | `"2025-12-20T15:03:28.533603"` |

#### Active Period Rules

**Non-recurring plans:**
- `active_period` is optional
- When `active_period` is provided, both `start` and `end` are required
- The `start` and `end` values are used as the start and end date and time for the active period of the package and override any validity period configured in the plan
- When `active_period` is not provided, the package uses the default behavior: activation at first use

**Recurring plans:**
- `active_period` is optional
- When `active_period` is provided, `start` is required and `end` is optional
- If `end` is provided for a recurring plan, it is ignored
- If `active_period` is not provided, the recurring subscription also uses the default behavior: activation at first use

**When a Start date is provided for a recurring plan:**
- Start date in the past (maximum 24 hours): the first subscriber package is created immediately
- Start date in the future but within the next 12 hours: the first subscriber package is also created immediately
- Start date more than 12 hours in the future: no subscriber package is created immediately; the first subscriber package will be created by the system 12 hours before its activation time

### Response 201 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `subscription_id` | string | ✓ | The unique identifier for the created subscription | `"a3b60fe5-a6ae-4b33-b5b0-9fae1832aa64"` |
| `created_at` | string | ✓ | Timestamp indicating when the subscription was created | `"2025-08-08T11:05:57.703Z"` |
| `activation_at` | string/null | | Present only when active_period was provided in the request | `"2025-12-10T15:03:28.533603Z"` |
| `expiration_at` | string/null | | Present only when active_period was provided in the request | `"2025-12-20T15:03:28.533603Z"` |
| `metadata` | string | ✓ | The metadata provided in the request | `"usa recurring plan"` |
| `esimdata` | object | ✓ | An object containing details about the eSIM or Physical SIM | |
| `esimdata.esim_id` | string | ✓ | The unique identifier for the eSIM | `"65a89dca-349e-4278-95fb-a8fe2e9b281f"` |
| `esimdata.iccid` | string | ✓ | The Integrated Circuit Card Identifier for the eSIM | `"8937103400004164763"` |
| `esimdata.label` | string | ✓ | A label associated with the eSIM | `"blue"` |
| `esimdata.lpa_string` | string/null | | The LPA string associated with the eSIM | `"LPA:1$rsp-eu.redteamobile.com$0F222CA0C9B2F3A99457DADC94A4958C"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

### Response 404 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates error occurred | `true` |
| `message` | string | ✓ | Error message | `"No available eSIM record found for the specified plan label"` |

---

## Get a Subscription

This endpoint retrieves the details of a specific subscription associated with an eSIM, identified by its ICCID. It provides information such as the subscription ID, creation date, metadata, and SIM or Physical SIM details.

**Endpoint:** `GET /v3/subscriptions/{iccid}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the subscription |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether there was an error processing the request | |
| `data` | object | ✓ | Contains the details of the subscription | |
| `data.subscription_id` | string | ✓ | The unique identifier for the subscription | `"38838e12-4394-4e04-bb11-9250e835668e"` |
| `data.created_at` | string | ✓ | The timestamp when the subscription was created | `"2025-08-17T15:16:00.890Z"` |
| `data.metadata` | string | ✓ | Additional metadata related to the subscription | `"Subscription for USA"` |
| `data.esim` | object | ✓ | Contains details about the SIM | |
| `data.esim.esim_id` | string | ✓ | The unique identifier for the SIM (eSIM or Physical SIM) | `"5a15183b-ca25-4725-b8a8-807990f98e03"` |
| `data.esim.iccid` | string | ✓ | The ICCID of the SIM (eSIM or Physical SIM) | `"8937103400004164763"` |
| `data.esim.lpa_string` | string/null | | The LPA string associated with the eSIM else null for physical SIM | `"LPA:1$rsp-eu.redteamobile.com$0F222CA0C9B2F3A99457DADC94A4958C"` |
| `data.esim.label` | string | ✓ | A label for the SIM | `"blue"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Delete a Subscription

Deletes the subscription and recycles the ICCID associated with it. The associated ICCID goes back into the customer inventory and will be picked up again automatically in the creation of a new subscription at some point in time in future.

> **Note:** This operation will fail if the eSIM profile associated with the ICCID was ever downloaded by an end-user.

**Endpoint:** `DELETE /v3/subscriptions/{iccid}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the subscription to delete |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | A boolean indicating whether there was an error in the request | |
| `message` | string | ✓ | A message indicating the result of the delete operation | `"Subscription deleted successfully"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

### Response 403 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | A boolean indicating whether there was an error in the request | `true` |
| `message` | string | ✓ | A message indicating the reason for the unauthorized delete response | `"Cannot delete a subscription whose esim was installed on a device"` |

---

## List Plan Attachments

This endpoint retrieves the plan attachments associated with a specific subscription identified by its ICCID.

**Endpoint:** `GET /v3/subscriptions/{iccid}/plan-attachments`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the subscription |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | A boolean indicating whether there was an error in the request | |
| `data` | array | ✓ | An array containing details of the plan attachments | |
| `data.plan_attachment_id` | string | ✓ | The unique identifier for the plan attachment | `"efff707e-7db0-4ffe-bef9-5817cabcba3b"` |
| `data.created_at` | string | ✓ | The timestamp when the plan attachment was created | `"2025-08-17T15:15:59.000Z"` |
| `data.activation_at` | string/null | | The timestamp when the plan attachment was activated (may be null) | `"2025-08-17T15:15:59.000Z"` |
| `data.expiration_at` | string/null | | The timestamp when the plan attachment will expire (may be null) | `"2025-08-17T15:15:59.000Z"` |
| `data.used_allowance` | object | ✓ | An object containing usage details | |
| `data.used_allowance.dataBytes` | number | ✓ | The amount of data used in bytes | `100` |
| `data.state` | string | ✓ | The current state of the plan attachment | `"PENDING_FOR_FIRST_USE"`, `"CREATED"`, `"ACTIVE"`, `"SUSPENDED"`, `"EXPIRED"` |
| `data.plan` | object | ✓ | The plan details associated with this attachment | |
| `data.plan.name` | string | | The name of the plan | `"Usa plan green 1gb 7 days"` |
| `data.plan._id` | string | | The unique identifier for the plan | `"e90b8df8-fc8a-4010-8d70-13c756017747"` |
| `data.plan.coverage_id` | string | | The unique identifier for the coverage area | `"24648a7f-8281-4af7-8fc0-19b2371b2d1d"` |
| `data.plan.region_code` | string | | The region code for the plan | `"US"` |
| `data.plan.label` | string | | The label or tier of the plan | `"Green"` |
| `data.plan.throttling` | boolean | | Indicates whether throttling is enabled for this plan | |
| `data.plan.recurring` | boolean | | Indicates whether this is a recurring plan | |
| `data.plan.data_mega_bytes` | integer | | The data allowance in megabytes | `1024` |
| `data.plan.period_days` | integer | | The duration of the plan in days | `7` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Get a Plan Attachment

This endpoint retrieves the details of a specific plan attachment for a subscription.

**Endpoint:** `GET /v3/subscriptions/{iccid}/plan-attachments/{plan_id}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the subscription |
| `plan_id` | string | ✓ | The plan attachment ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | | Indicates whether there was an error | |
| `data` | object | | The plan attachment details | |
| `data.plan_attachment_id` | string | | The unique identifier for the plan attachment | `"ba3b527f-4a01-42e2-892a-fff6d217217e"` |
| `data.created_at` | string | | The timestamp when the plan attachment was created | `"2025-08-30T08:00:18.681Z"` |
| `data.activation_at` | string/null | | The timestamp when the plan attachment was activated | `"2025-08-30T08:00:18.681Z"` |
| `data.expiration_at` | string/null | | The timestamp when the plan attachment will expire | `"2025-08-30T08:00:18.681Z"` |
| `data.used_allowance` | object | | An object containing usage details | |
| `data.used_allowance.dataBytes` | number | | The amount of data used in bytes | `100` |
| `data.state` | string | | The current state of the plan attachment | `"CREATED"` |
| `data.plan` | object | | The plan details | |
| `data.plan.name` | string | | The name of the plan | `"Usa plan green 1gb 7 days"` |
| `data.plan._id` | string | | The unique identifier for the plan | `"e90b8df8-fc8a-4010-8d70-13c756017747"` |
| `data.plan.coverage_id` | string | | The unique identifier for the coverage area | `"24648a7f-8281-4af7-8fc0-19b2371b2d1d"` |
| `data.plan.region_code` | string | | The region code for the plan | `"US"` |
| `data.plan.label` | string | | The label or tier of the plan | `"Green"` |
| `data.plan.throttling` | boolean | | Indicates whether throttling is enabled | |
| `data.plan.recurring` | boolean | | Indicates whether this is a recurring plan | |
| `data.plan.data_mega_bytes` | integer | | The data allowance in megabytes | `1024` |
| `data.plan.period_days` | integer | | The duration of the plan in days | `7` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Suspend a Plan Attachment

This operation stops all telco services on this attachment and puts it in a suspended state. **This is a non-reversible operation.**

**Endpoint:** `POST /v3/subscriptions/{iccid}/plan-attachments/{id}/suspend`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the subscription |
| `id` | string | ✓ | The plan attachment ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | A boolean indicating whether an error occurred during the request | |
| `message` | string | ✓ | A string containing any error message, if applicable | `"Plan attachment suspended successfully"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Send SMS

This endpoint allows you to send an SMS message to a specified eSIM subscription identified by its ICCID. The request requires an API key for authentication and includes parameters for the sender's name and the message content.

**Endpoint:** `POST /v3/subscriptions/{iccid}/send-sms`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the subscription |

### Request Body (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `from` | string | ✓ | The sender's name | `"tellisim"` |
| `message` | string | ✓ | The message content | `"test message"` |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred (true if an error occurred) | |
| `message` | string | ✓ | A message providing additional information about the success response | `"SMS sent successfully"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

### Response 502 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred (true if an error occurred) | `true` |
| `message` | string | ✓ | A message providing additional information about the failure response | `"SMS Delivery Failed"` |

---

## Get Subscription Location

Returns the last known network attach for the eSIM. Only returns data if the eSIM has been active within the last 7 days; for disabled, deleted, or never-activated profiles the operator block is empty.

**Endpoint:** `GET /v3/subscriptions/{iccid}/location`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the subscription |

### Response 200 (application/json)

> ⚠️ **Confirmed live shape (verified against production 2026-06-16):** this response has **no `data` wrapper**, unlike `/v3/sims/{iccid}`. The payload is `error` + `last_operator` at the top level.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred | `false` |
| `last_operator.country` | string | | Country name of the last attach | `"United States"` |
| `last_operator.country_alpha_2` | string | | ISO 3166-1 alpha-2 country code | `"us"` |
| `last_operator.operator` | string | | Mobile network operator name | `"AT&T USA"` |
| `last_operator.event_time` | string (date-time) | | Timestamp of the last attach | `"2026-08-11T18:29:48Z"` |
| `last_operator.rat` | string | | Radio access technology | `"4G"` |
| `last_operator.imei` | string | | Device IMEI seen on the network (returned for active SIMs; `brand`/`model` are frequently absent even when `imei` is present) | `"356938035643809"` |

---

## Get Network Events

Retrieves network attach and data session events for a single subscription (by ICCID) over a date range. This is the **primary connectivity-debugging endpoint** — it tells you whether an eSIM attached to a network at all, and if it did, whether its data sessions succeeded.

**Endpoint:** `POST /v3/subscriptions/{iccid}/network-events`  
**Security:** ApiKeyAuth

### Constraints

- Maximum period is **7 days**, counting both the start and end dates (e.g. `2026-08-15` → `2026-08-21`).
- `start` must come before `end`.
- Requests that violate either constraint are **rejected** (see Response 400).

To cover a longer window, issue several requests of ≤ 7 days each and merge the arrays client-side.

### Path Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `iccid` | string | ✓ | The ICCID of the subscription | `8948010000094659307` |

### Request Body (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `period` | object | ✓ | The time period to retrieve events for. Maximum 7 days including start and end dates. | |
| `period.start` | string (date) | ✓ | Start date, `YYYY-MM-DD`. Must come before the end date. | `"2026-08-15"` |
| `period.end` | string (date) | ✓ | End date, `YYYY-MM-DD`. Maximum 7 days from start (inclusive). | `"2026-08-21"` |

```bash
curl -i -X POST \
  'https://api.tellisim.com/v3/subscriptions/8948010000094659307/network-events?key=${TELLISIM_API_KEY}' \
  -H 'Content-Type: application/json' \
  -d '{
    "period": {
      "start": "2026-08-15",
      "end": "2026-08-21"
    }
  }'
```

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether there was an error processing the request | `false` |
| `label` | string | | Label enum — `Green`, `Aqua`, `Blue`, `Voilet`, `Red`, `Grey`, `Orange` (see Labels Reference) | `"Green"` |
| `data` | object | ✓ | The network events recorded during the period | |
| `data.2g_or_3g_attach` | array | ✓ | Network attach events for 2G/3G connections | |
| `data.4g_or_5g_attach` | array | ✓ | Network attach events for 4G/5G connections | |
| `data.data_usage` | array | ✓ | Data session events (`Init` / `Update` / `Term`) | |

#### `data.2g_or_3g_attach[]`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `event_time` | string (date-time) | ✓ | Timestamp (UTC) when the attach event occurred | `"2026-08-17T21:51:27Z"` |
| `country_name` | string | ✓ | Country where the event occurred | `"Morocco"` |
| `country_alpha_2` | string | ✓ | ISO 3166-1 alpha-2 country code (lowercase) | `"ma"` |
| `operator` | string | ✓ | Mobile network operator name | `"Inwi Morocco"` |
| `result` | string | ✓ | **`"ok"` means the attach succeeded.** Anything else is a failure. | `"ok"` |

#### `data.4g_or_5g_attach[]`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `event_time` | string (date-time) | ✓ | Timestamp (UTC) when the attach event occurred | `"2026-08-20T22:54:25Z"` |
| `country_name` | string | ✓ | Country where the event occurred | `"Morocco"` |
| `country_alpha_2` | string | ✓ | ISO 3166-1 alpha-2 country code (lowercase) | `"ma"` |
| `operator` | string | ✓ | Mobile network operator name | `"Inwi Morocco"` |
| `oper_allowed` | boolean | ✓ | **`true` means the operator allowed the attach and it succeeded.** `false` means the operator refused the eSIM. | `true` |

#### `data.data_usage[]`

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `event_time` | string (date-time) | ✓ | Timestamp (UTC) when the data session event occurred | `"2026-08-21T06:32:32Z"` |
| `request_type` | string | ✓ | Type of data session request — `Init`, `Update`, or `Term` | `"Update"` |
| `country_name` | string | ✓ | Country where the event occurred | `"Morocco"` |
| `country_alpha_2` | string | ✓ | ISO 3166-1 alpha-2 country code (lowercase) | `"ma"` |
| `operator` | string | ✓ | Mobile network operator name | `"Inwi Morocco"` |
| `result` | string | ✓ | **`"success"` means the eSIM was able to use data.** Anything else is a failed session. | `"success"` |

```json
{
  "error": false,
  "label": "Green",
  "data": {
    "2g_or_3g_attach": [
      {
        "event_time": "2026-08-17T21:51:27Z",
        "country_name": "Morocco",
        "country_alpha_2": "ma",
        "operator": "Inwi Morocco",
        "result": "ok"
      }
    ],
    "4g_or_5g_attach": [
      {
        "event_time": "2026-08-20T22:54:25Z",
        "country_name": "Morocco",
        "country_alpha_2": "ma",
        "operator": "Inwi Morocco",
        "oper_allowed": true
      }
    ],
    "data_usage": [
      {
        "event_time": "2026-08-21T06:32:32Z",
        "request_type": "Update",
        "country_name": "Morocco",
        "country_alpha_2": "ma",
        "operator": "Inwi Morocco",
        "result": "success"
      }
    ]
  }
}
```

> ⚠️ **Field-name discrepancy — parse defensively.** TelliSIM's own sample payload (shared by their support team, Aug 2026) uses **camelCase** keys — `eventTime`, `countryName`, `countryAlpha2`, `requestType` — and returns `oper_allowed` as the **string** `"true"` rather than a boolean, with local-offset timestamps (`2026-08-11T18:29:48.932+02:00`) instead of the UTC `Z` form the schema specifies. The published reference (above) is snake_case with a real boolean. This is the same class of inconsistency already seen on `lpa` / `lpastring` / `lpa_string`. Any client we write must accept **both** casings and treat `oper_allowed` as truthy-string-or-boolean, and must not assume `Z`-suffixed timestamps.

### Response 400 (application/json)

Returned when the period exceeds 7 days, or when `start` is not before `end`.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred | `true` |
| `message` | string | ✓ | Description of the constraint that was violated | `"Invalid period"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

### Response 404 (application/json)

Returned when no subscription exists for the supplied ICCID.

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred | `true` |
| `message` | string | ✓ | Error message | `"Subscription not found"` |

### As implemented in this repo

> **Implementing this elsewhere, or onboarding someone to it?** Read
> **`docs/TELLISIM_NETWORK_INTENT_GUIDE.md`** — a self-contained build guide
> covering the live payload quirks, the intent algorithm, the storage design,
> a security checklist, and a verification recipe.

| Piece | Location |
|-------|----------|
| API call | `getNetworkEvents()` — `src/lib/tellisim-client.ts` |
| Dual-casing normalizer + intent analysis | `src/lib/network-events.ts` |
| Route (pull → analyze → persist) | `POST /api/tellisim/network-events/[iccid]` |
| Demand read-back | `GET /api/tellisim/network-events` — country leaderboard; `?iccid=` for raw events |
| Storage | `network_intent_events` table — one row per event in an uncovered country |
| UI | "Network Activity" panel in the ICCID lookup (`src/components/lookup/iccid-lookup.tsx`) |

Three decisions worth knowing before changing any of it:

- **Coverage is resolved server-side.** The route fetches the plan attachment and its coverage profile itself rather than trusting a caller-supplied country list — otherwise any client could mark arbitrary countries as uncovered and poison the demand dataset. When coverage cannot be resolved, `coverageKnown` is false and **no** findings are produced, so a lookup failure can never be misread as "the customer went off-plan."
- **Rows are stored at event grain**, keyed on `(iccid, country_alpha_2, event_time, kind)`. Re-pulling an overlapping 7-day window is therefore idempotent — repeat lookups `onConflictDoNothing` instead of inflating counts. Country-level demand is a `GROUP BY`, not a stored counter.
- **`resolveIso2()` falls back to the country name** when `country_alpha_2` is absent, on both sides of the comparison but for opposite reasons: on the event side a missing code would silently drop a real finding, on the covered side it would fabricate one. The bias is toward a larger covered set — a missed finding costs less than an invented one. An unrecognised name resolves to null and the event is skipped, never guessed.

**Blind spot this cannot see.** An attach only reaches this endpoint if the visited network's request actually got to TelliSIM's core, which needs roaming interconnect. A country with no interconnect at all — or a device whose PLMN list stops it from trying — produces no event to capture. That surfaces as `verdict: "no_events"`, which cannot distinguish "never switched on" from "somewhere invisible to us."

### Debugging playbook — "my eSIM doesn't work"

Use this endpoint to narrow down **where** the failure happened. The two stages are sequential: an eSIM must attach to a network before it can pass data.

**Stage 1 — did it attach to the network?**

Check `2g_or_3g_attach` or `4g_or_5g_attach`, depending on which network the device is trying to use.

| Array | Success condition | Failure condition |
|-------|-------------------|-------------------|
| `2g_or_3g_attach` | `result == "ok"` | any other `result` value |
| `4g_or_5g_attach` | `oper_allowed == true` | `oper_allowed == false` — the operator refused the eSIM |

- **No attach events at all** → the device never even tried on a network TelliSIM sees. Look at the device side: is the profile installed and enabled, is data roaming on, is the APN right, is the device SIM-locked?
- **Attach events present but all failing** → the eSIM reached the network and was rejected. Confirm the operator is in the plan's coverage profile (`GET /v3/coverage-profiles/{coverageId}`), then escalate to carrier ops with the `operator` + `country_name` + `event_time` from the failing event.
- **Attach succeeded** → go to Stage 2.

**Stage 2 — could it actually use data?**

Check `data_usage`.

- `result == "success"` → the data session worked. If the customer still reports "no internet", the problem is downstream: allowance exhausted (check `used_allowance.dataBytes` vs `plan.data_mega_bytes` on the plan attachment), throttling, or a device/perception issue.
- `result` anything else → the session failed after a successful attach. Capture `request_type`, `operator`, and `event_time` and escalate — this is a vendor-side problem, not a device problem.
- **Attach succeeded but `data_usage` is empty** → the eSIM registered on the network but never opened a data session. Usually an APN or device-configuration issue.

Read `request_type` as the session lifecycle: `Init` opens a session, `Update` refreshes it mid-session, `Term` closes it. A long run of `Init` with no `Update` suggests sessions that open and immediately drop.

---

# Plans

Operations related to plans.

---

## List Plans

This endpoint retrieves a list of available plans. It allows users to specify pagination and filter out archived plans.

**Endpoint:** `GET /v3/plans`  
**Security:** ApiKeyAuth

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `archived` | boolean | | When true, only archived plans are returned. When false, only non archived plans are returned. When absent all are returned. | |
| `page_size` | string | | Number of items to be returned in a single page | |
| `page` | string | | A cursor for pagination across multiple pages of results. Don't include this parameter on the first call. | |
| `label` | string | | Filter plans by label. Allowed values: `Green`, `Aqua`, `Blue`, `Voilet`, `Red`, `Grey`, `Orange` | |
| `search_query` | string | | Query to search the plans by name | |
| `country_iso_2` | string | | Comma separated list of countryIso2 | `"FR,IN"` |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates if there was an error in the request | |
| `data` | array | ✓ | An array of plan objects returned by the request | |
| `data.plan_name` | string | ✓ | Name of the plan | `"USA Plan"` |
| `data.plan_id` | string | ✓ | Unique identifier for the plan | `"39c3ae26-22a5-49cb-93ca-2fe65b3a5c69"` |
| `data.coverage_id` | string | ✓ | Identifier for the coverage area of the plan | `"819b05c4-f154-4df9-8fd1-16be3e82f5c6"` |
| `data.archived_at` | string/null | ✓ | Timestamp of when the plan was archived (if applicable) | |
| `data.region_code` | string | ✓ | Code representing the region for the plan | `"US"` |
| `data.label` | string | ✓ | Label for the plan | `"blue"` |
| `data.created_at` | string | ✓ | Timestamp of when the plan was created | `"2025-01-01T00:00:00Z"` |
| `data.throttling` | boolean | ✓ | Indicates if the plan has throttling enabled | `true` |
| `data.recurring` | boolean | ✓ | Indicates if the plan is recurring | `true` |
| `data.data_mega_bytes` | integer | ✓ | Amount of data in megabytes included in the plan | `1024` |
| `data.period_days` | integer | ✓ | Duration of the plan in days | `30` |
| `data.archive` | boolean | ✓ | Indicates if the plan is archived | |
| `data.period_iterations` | integer | | Number of iterations for the plan period | `12` |
| `data.throttling_threshold1_perc` | integer | | The percentage threshold for first throttling | `50` |
| `data.throttling_threshold1_limit` | string | | The limit associated with the first throttling threshold. Enum: `"32"`, `"64"`, `"128"`, `"256"`, `"384"`, `"512"`, `"1024"`, `"3072"`, `"5120"`, `"7680"`, `"10240"`, `"20480"` | |
| `data.throttling_threshold2_perc` | integer | | The percentage threshold for second throttling | `80` |
| `data.throttling_threshold2_limit` | string | | The limit associated with the second throttling threshold | |
| `data.throttling_threshold3_perc` | integer | | The percentage threshold for third throttling | `90` |
| `data.throttling_threshold3_limit` | string | | The limit associated with the third throttling threshold | |
| `data.nb_occurrence` | integer | | The number of occurrences for the plan | `12` |
| `data.recurring_periodicity_type` | string | | The type of periodicity for the recurring plan. `0`=Daily, `1`=Weekly, `2`=Monthly | |
| `data.recurring_periodicity_frequency` | integer | | The frequency of the recurring billing cycle | `1` |
| `next_page` | string/null | ✓ | Token for the next page of results, if available | |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Create Plans

Creates a plan with the given configuration.

**Endpoint:** `POST /v3/plans`  
**Security:** ApiKeyAuth

### Request Body (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `coverage_id` | string | ✓ | Coverage ID of the region | `"819b05c4-f154-4df9-8fd1-16be3e82f5c6"` |
| `data_MBs` | number | ✓ | The amount of MBs you want in the plan | `1024` |
| `name` | string | ✓ | Name of the plan which can be anything you like | `"test1 recurring and throttling package"` |
| `period_days` | number | ✓ | Plan validity in days | `1` |
| `recurring` | boolean | ✓ | Set to true if you want the plan to be recurring | `true` |
| `throttling` | boolean | ✓ | Set to true if you want the plan to be throttled | `true` |
| `nb_occurrence` | number | | The number of occurrences for the plan. Required if recurring is true. | `2` |
| `recurring_periodicity_type` | string | | Recurring periodicity type. `0`=Daily, `1`=Weekly, `2`=Monthly. Required if recurring is true. | |
| `recurring_periodicity_frequency` | number | | Along with recurring_periodicity_type will determine the frequency at which the subscriber will receive its packages. Required if recurring is true. | `2` |
| `throttling_threshold1_perc` | number | | First threshold for throttling, in percentage of the total volume of the package. Required if throttling is true. | `50` |
| `throttling_threshold1_limit` | string | | Limit to apply when the subscriber is crossing the first threshold. Units: Kbit/sec. Required if throttling is true. Enum: `"128"`, `"256"`, `"384"`, `"512"`, `"1024"`, `"3072"`, `"5120"`, `"7680"`, `"10240"`, `"20480"` | |
| `throttling_threshold2_perc` | number | | Second threshold for throttling, in percentage. Required if throttling is true. | `90` |
| `throttling_threshold2_limit` | string | | Limit to apply when the subscriber is crossing the second threshold. Required if throttling_threshold2_perc is present. | |
| `throttling_threshold3_perc` | number | | Third threshold for throttling, in percentage. Required if throttling is true. | `100` |
| `throttling_threshold3_limit` | string | | Limit to apply when the subscriber is crossing the third threshold. Required if throttling_threshold3_perc is present. | |

### Response 201 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates if there was an error processing the request | |
| `message` | string | ✓ | A message providing additional information about the error (if any) | `"plan created successfully"` |
| `plan_id` | string | ✓ | The unique identifier for the newly created plan (if successful) | `"39c3ae26-22a5-49cb-93ca-2fe65b3a5c69"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Get a Plan

Retrieves the details of an existing plan by its ID.

**Endpoint:** `GET /v3/plans/{planId}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `planId` | string | ✓ | The plan ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | |
| `data` | object | ✓ | Contains the details of the requested plan | |
| `data.plan_name` | string | ✓ | Name of the plan | `"USA Plan"` |
| `data.plan_id` | string | ✓ | The unique identifier of the plan | `"0a3ee1d6-fe5e-4561-91a0-d4649aaf0754"` |
| `data.coverage_id` | string | ✓ | The ID associated with the plan's coverage | `"819b05c4-f154-4df9-8fd1-16be3e82f5c6"` |
| `data.archived_at` | string/null | ✓ | Timestamp indicating when the plan was archived, if applicable | `"2025-01-01T00:00:00Z"` |
| `data.region_code` | string | ✓ | The code representing the region for the plan | `"US"` |
| `data.label` | string | ✓ | A human-readable label for the plan | `"blue"` |
| `data.throttling` | boolean | ✓ | Indicates if throttling is applied to the plan | `true` |
| `data.recurring` | boolean | ✓ | Indicates if the plan has a recurring billing cycle | `true` |
| `data.archive` | boolean | ✓ | Indicates if the plan is archived | `true` |
| `data.data_mega_bytes` | integer | ✓ | The amount of data in megabytes included in the plan | `1024` |
| `data.period_days` | integer | ✓ | The duration of the plan in days | `1` |
| `data.throttling_threshold1_perc` | integer | | The percentage threshold for first throttling | `10` |
| `data.throttling_threshold1_limit` | string | | The limit associated with the first throttling threshold | |
| `data.throttling_threshold2_perc` | integer | | The percentage threshold for second throttling | `10` |
| `data.throttling_threshold2_limit` | string | | The limit associated with the second throttling threshold | |
| `data.throttling_threshold3_perc` | integer | | The percentage threshold for third throttling | `10` |
| `data.throttling_threshold3_limit` | string | | The limit associated with the third throttling threshold | |
| `data.nb_occurrence` | integer | | The number of occurrences for the plan | `2` |
| `data.recurring_periodicity_type` | string | | The type of periodicity for the recurring plan. `0`=Daily, `1`=Weekly, `2`=Monthly | `"2"` |
| `data.recurring_periodicity_frequency` | integer | | The frequency of the recurring billing cycle | |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Delete a Plan

Deletes plan with the given ID. Deleting a plan won't impact the existing and historic attachments for this plan. They will continue to work as expected.

**Endpoint:** `DELETE /v3/plans/{planId}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `planId` | string | ✓ | The plan ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | | Indicates if an error occurred | |
| `message` | string | | A message indicating the result of the operation | `"Plan deleted successfully"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | A boolean indicating whether there was an error in the request | `true` |
| `message` | string | ✓ | A message indicating the reason for the unauthorized delete response | `"Cannot delete a subscription whose esim was installed on a device"` |

---

## Archive a Plan

This endpoint allows you to archive a specific plan identified by its planId. Archiving a plan may be necessary for managing your plans effectively, especially when they are no longer active or needed.

**Endpoint:** `POST /v3/plans/{planId}/archive`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `planId` | string | ✓ | The plan ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether there was an error processing the request | |
| `message` | string | ✓ | A message providing additional information about the request status | `"Plan archived successfully"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Unarchive a Plan

This endpoint allows you to unarchive a specific plan identified by its planId. When a plan is unarchived, it is restored to an active state, making it available for use again.

**Endpoint:** `POST /v3/plans/{planId}/unarchive`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `planId` | string | ✓ | The plan ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether there was an error processing the request | |
| `message` | string | ✓ | A message providing additional information about the request status | `"Plan unarchived successfully"` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

# Coverage

Operations related to coverage.

---

## List Coverage Profiles

Returns the list of coverage profiles available to your account.

**Endpoint:** `GET /v3/coverage-profiles`  
**Security:** ApiKeyAuth

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `region_code` | string | | Filter by region code | `"US"` |
| `label` | string | | Filter by label | `"Green"` |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred | |
| `data` | array | ✓ | Array of coverage profiles | |
| `data.coverage_id` | string | ✓ | The unique identifier for the coverage profile | `"24648a7f-8281-4af7-8fc0-19b2371b2d1d"` |
| `data.label` | string | ✓ | The label for the coverage profile | `"Green"` |
| `data.region_name` | string | ✓ | The name of the region for which the coverage is applicable | `"United States"` |
| `data.region_code` | string | ✓ | The ISO code of the region for which the coverage is applicable | `"US"` |
| `data.countries` | array | | Optional list of countries included in this coverage profile | |
| `data.countries.iso2` | string | | ISO 2-letter country code | `"US"` |
| `data.countries.iso3` | string | | ISO 3-letter country code | `"USA"` |
| `data.countries.name` | string | | Country name | `"United States"` |
| `data.countries.operators` | array | | Optional list of operators available in this country for the coverage profile | |
| `data.countries.operators.operator_id` | string | | The unique identifier for the operator | `"2dea792a-2dea-492c-815d-8fb826be8d49"` |
| `data.countries.operators.name` | string | | The name of the operator | `"AT&T USA"` |
| `data.countries.operators.supported_rats` | array | | List of supported Radio Access Technologies (RATs) | `["4G","5G"]` |
| `data.countries.operators.mcc_mnc` | array | | List of MCC-MNC codes associated with the operator | `["310-680","310-410"]` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Get the Coverage Profile

Retrieves the coverage profile.

**Endpoint:** `GET /v3/coverage-profiles/{coverageId}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `coverageId` | string | ✓ | The coverage profile ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | |
| `data` | object | ✓ | Coverage profile details | |
| `data.coverage_id` | string | ✓ | The unique identifier for the coverage profile | `"24648a7f-8281-4af7-8fc0-19b2371b2d1d"` |
| `data.label` | string | ✓ | The label for the coverage profile | `"Green"` |
| `data.region_name` | string | ✓ | The name of the region for which the coverage is applicable | `"United States"` |
| `data.region_code` | string | ✓ | The ISO code of the region for which the coverage is applicable | `"US"` |
| `data.countries` | array | | Optional list of countries included in this coverage profile | |
| `data.countries.iso2` | string | | ISO 2-letter country code | `"US"` |
| `data.countries.iso3` | string | | ISO 3-letter country code | `"USA"` |
| `data.countries.name` | string | | Country name | `"United States"` |
| `data.countries.operators` | array | | Optional list of operators available in this country for the coverage profile | |
| `data.countries.operators.operator_id` | string | | The unique identifier for the operator | `"2dea792a-2dea-492c-815d-8fb826be8d49"` |
| `data.countries.operators.name` | string | | The name of the operator | `"AT&T USA"` |
| `data.countries.operators.supported_rats` | array | | List of supported Radio Access Technologies (RATs) | `["4G","5G"]` |
| `data.countries.operators.mcc_mnc` | array | | List of MCC-MNC codes associated with the operator | `["310-680","310-410"]` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Create Custom Region Coverage Profile

Creates a custom region coverage profile using a list of ISO 2-letter country codes.

**Validation checks:**
- **Duplicate name check:** If a region with the same name already exists for this organization, returns 400 Bad Request
- **Duplicate coverage check:** If a coverage profile with the exact same set of countries already exists, returns 409 Conflict with the existing profile details

> **Note:** Coverage profiles are immutable and cannot be deleted. You can only create new profiles.

**Endpoint:** `POST /v3/coverage-profiles/custom-region`  
**Security:** ApiKeyAuth

### Request Body (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `region_name` | string | ✓ | The name of the custom region | `"Usa and Mexico Regional Plan"` |
| `label` | string | ✓ | The label. Enum: `"Green"`, `"Aqua"`, `"Blue"`, `"Voilet"`, `"Red"`, `"Grey"`, `"Orange"` | |
| `iso2_list` | array | ✓ | List of ISO 2-letter country codes included in the custom region | `["US","MX"]` |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | |
| `data` | object | ✓ | Created coverage profile details | |
| `data.coverage_id` | string | ✓ | The unique identifier for the coverage profile | `"85089a51-801c-4737-bd8b-f542705712bf"` |
| `data.region_code` | string | ✓ | The generated region code for the custom region | `"R33BHT"` |
| `data.region_name` | string | ✓ | The name of the custom region | `"Usa and Mexico Regional Plan"` |
| `data.iso2_list` | array | ✓ | List of ISO 2-letter country codes included in the custom region | `["US","MX"]` |

### Response 400 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates error | `true` |
| `message` | string | ✓ | Error message | `"Custom region with this name already exists for this organization"` |
| `missing_iso2` | array | | List of ISO2 country codes from the request for which no operators were found | |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

### Response 409 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates error | `true` |
| `message` | string | ✓ | Error message | `"Coverage id with same operator already exists"` |
| `existing_coverage` | object | ✓ | Details of the existing coverage profile | |
| `existing_coverage.coverage_id` | string | ✓ | The coverage ID | `"85089a51-801c-4737-bd8b-f542705712bf"` |
| `existing_coverage.region_code` | string | ✓ | The region code | `"R33BHT"` |
| `existing_coverage.region_name` | string | ✓ | The region name | `"TEST USA and Mexico"` |
| `existing_coverage.iso2_list` | array | ✓ | The list of countries | `["US","MX"]` |

---

# SIM

Operations related to SIM management.

---

## List SIMs

This endpoint retrieves a list of SIMs (both eSIMs and physical SIM cards) associated with organization.

**Endpoint:** `GET /v3/sims`  
**Security:** ApiKeyAuth

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `page_size` | string | | Number of items per page | |
| `page` | string | | Pagination cursor | |
| `is_esim` | boolean | | Filter by eSIM or physical SIM | |
| `label` | string | | Filter by label | `"Green"` |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | |
| `data` | array | ✓ | Contains an array of SIM objects | |
| `data.iccid` | string | ✓ | The Integrated Circuit Card Identifier of the eSIM | `"8937103400004164763"` |
| `data.label` | string | ✓ | A label for the eSIM | `"Blue"` |
| `data.lpa` | string/null | | The Local Profile Assistant associated with the eSIM if the SIM is an eSIM | `"LPA:1$rsp-eu.redteamobile.com$0F222CA0C9B2F3A99457DADC94A4958C"` |
| `data.used` | boolean | | Indicates if the SIM has been used or not | |
| `data.esim_id` | string | ✓ | The unique identifier for the eSIM | `"5a15183b-ca25-4725-b8a8-807990f98e03"` |
| `data.created_at` | string | ✓ | The timestamp when the SIM was created | `"2025-08-11T14:43:15.761Z"` |
| `data.is_esim` | boolean | ✓ | Indicates if the item is an eSIM or not | `true` |
| `next_page` | string/null | ✓ | A token for pagination, indicating if there are more results available | `"MQ=="` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Get SIM Details

This endpoint retrieves the details of a specific SIM by its ICCID.

**Endpoint:** `GET /v3/sims/{iccid}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the SIM |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | | Indicates whether an error occurred | |
| `data` | object | | SIM details | |
| `data.iccid` | string | ✓ | The Integrated Circuit Card Identifier of the eSIM | `"8937103400004164763"` |
| `data.label` | string | ✓ | A label for the eSIM | `"Blue"` |
| `data.lpa` | string/null | | The Local Profile Assistant associated with the eSIM if the SIM is an eSIM | `"LPA:1$rsp-eu.redteamobile.com$0F222CA0C9B2F3A99457DADC94A4958C"` |
| `data.used` | boolean | | Indicates if the SIM has been used or not | |
| `data.esim_id` | string | ✓ | The unique identifier for the eSIM | `"5a15183b-ca25-4725-b8a8-807990f98e03"` |
| `data.created_at` | string | ✓ | The timestamp when the SIM was created | `"2025-08-11T14:43:15.761Z"` |
| `data.is_esim` | boolean | ✓ | Indicates if the item is an eSIM or not | `true` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Get SIM SMDP Information

This endpoint retrieves the SM-DP+ (Subscription Manager Data Preparation) information for a specific SIM by its ICCID.

The response includes the state history of the eSIM profile with the following possible states:
- **BPP Installation:** The process of downloading and installing the eSIM profile via a Bootstrap Provisioning Platform (BPP)
- **Enable:** eSIM is switched on from device settings, allowing it to connect to the mobile network
- **Disable:** eSIM is turned off via device settings, temporarily preventing it from being used
- **Delete:** eSIM profile is completely removed from the device

**Endpoint:** `GET /v3/sims/{iccid}/smdp-info`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `iccid` | string | ✓ | The ICCID of the SIM |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | | Indicates whether an error occurred | |
| `data` | object | | SMDP information | |
| `data.iccid` | string | ✓ | The ICCID of the SIM | `"8937103400004164763"` |
| `data.state_history` | array | ✓ | History of state changes for the eSIM profile | |
| `data.state_history.state` | string | | The state of the eSIM profile. Enum: `"BPP Installation"`, `"Enable"`, `"Disable"`, `"Delete"` | |
| `data.state_history.modification_result` | string | | Result of the state modification | `"SUCCESS"` |
| `data.state_history.modified_at` | string | | Timestamp when the state was modified | `"2025-10-28T20:23:59.000Z"` |
| `data.current_status` | string | | Current status of the eSIM profile. Enum: `"BPP Installation"`, `"Enable"`, `"Disable"`, `"Delete"` | |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

# Operators

Operations related to operators.

---

## List Operators

Returns the list of operators filtered by optional label and country filters.

**Endpoint:** `GET /v3/operators`  
**Security:** ApiKeyAuth

### Query Parameters

| Parameter | Type | Required | Description | Example |
|-----------|------|----------|-------------|---------|
| `label` | string | | Filter operators by label. Allowed values: `Green`, `Aqua`, `Blue`, `Voilet`, `Red`, `Grey`, `Orange` | |
| `iso2_codes` | string | | Comma separated list of ISO 2-letter country codes | `"MX,US"` |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates if there was an error in the request | |
| `data` | array | ✓ | An array of operator objects returned by the request | |
| `data.operator_id` | string | ✓ | The unique identifier for the operator | `"2dea792a-2dea-492c-815d-8fb826be8d49"` |
| `data.name` | string | ✓ | The name of the operator | `"AT&T USA"` |
| `data.iso2` | string | ✓ | ISO 2-letter country code | `"US"` |
| `data.supported_rats` | array | ✓ | List of supported Radio Access Technologies (RATs) | `["4G","5G"]` |
| `data.mcc_mnc` | array | ✓ | List of MCC-MNC codes associated with the operator | `["310-680","310-410"]` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

## Get Operator

Retrieves the details of a specific operator.

**Endpoint:** `GET /v3/operators/{operatorId}`  
**Security:** ApiKeyAuth

### Path Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `operatorId` | string | ✓ | The operator ID |

### Response 200 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | |
| `data` | object | ✓ | Operator details | |
| `data.operator_id` | string | ✓ | The unique identifier for the operator | `"2dea792a-2dea-492c-815d-8fb826be8d49"` |
| `data.name` | string | ✓ | The name of the operator | `"AT&T USA"` |
| `data.iso2` | string | ✓ | ISO 2-letter country code | `"US"` |
| `data.supported_rats` | array | ✓ | List of supported Radio Access Technologies (RATs) | `["4G","5G"]` |
| `data.mcc_mnc` | array | ✓ | List of MCC-MNC codes associated with the operator | `["310-680","310-410"]` |

### Response 401 (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `error` | boolean | ✓ | Indicates whether an error occurred during the request | `true` |
| `message` | string | ✓ | Error message describing the unauthorized access | `"Unauthorized: API key is missing"` |

---

# Webhook Events

Operations related to webhook events.

---

## Validate Webhook Signature

Each webhook call generated from TelliSIM includes a unique signature header to validate call authenticity.

The webhook contains a header `x-tellisim-signature` which identifies the call signature for each user.

To validate the signature, you can use the official npm library:

- `@tellisim/webhook-signature-validator`  
  https://www.npmjs.com/package/@tellisim/webhook-signature-validator

**Basic usage:**

```ts
import * as tellisimSignatureValidator from '@tellisim/webhook-signature-validator';

tellisimSignatureValidator.validate(signature, signingKey, webhookDataObject);
```

| Field | Description |
|-------|-------------|
| `signature` | The header received in `x-tellisim-signature` field |
| `signingKey` | The signing key configured for your webhooks |
| `webhookDataObject` | The JSON payload received in the webhook call |

---

## Data Allowance Consumed

Triggered when 50%, 80%, or 100% of a fixed validity plan's data allowance is consumed (no events for recurring plans).

**Endpoint:** `POST attachment.allowanceConsumed`  
**Security:** ApiKeyAuth

### Webhook Payload (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `type` | string | ✓ | Event type | `"attachment.allowanceConsumed"` |
| `timestamp` | integer | ✓ | Unix timestamp when the event was fired | `1730474606` |
| `data` | object | ✓ | Event data | |
| `data.usagePercentage` | number | ✓ | Percentage of data allowance consumed | `80` |
| `data.dataUsageBytes` | number | ✓ | Data consumed in bytes | `1231230` |
| `data.esim` | string | ✓ | The eSIM or physical SIM identifier | `"8937103400004164763"` |
| `data.planId` | string | ✓ | The plan identifier | `"33de44b0-5103-45ea-9723-0a7aa104c76a"` |
| `data.attachmentId` | string | ✓ | The attachment identifier | `"a1ac5a45-e05b-4728-9253-17c54fc1c5ff"` |

---

## SIM Location Changed

Triggered when a SIM's country location changes.

**Endpoint:** `POST subscription.esim.locationChanged`  
**Security:** ApiKeyAuth

### Webhook Payload (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `type` | string | ✓ | Event type | `"subscription.esim.locationChanged"` |
| `timestamp` | integer | ✓ | Unix timestamp when the event was fired | `1759429928` |
| `data` | object | ✓ | Event data | |
| `data.esim` | string | ✓ | The eSIM or physical SIM identifier | `"8937204017179541233"` |
| `data.countryIso2` | string | ✓ | ISO 2-letter country code | `"IT"` |

---

## SIM SMDP Status Changed

The event is sent whenever the SMDP state of an event is changed.

**Endpoint:** `POST esim.smdp.stateChanged`  
**Security:** ApiKeyAuth

### Webhook Payload (application/json)

| Field | Type | Required | Description | Example |
|-------|------|----------|-------------|---------|
| `type` | string | ✓ | Event type | `"esim.smdp.stateChanged"` |
| `timestamp` | integer | ✓ | Unix timestamp when the event was fired | `1761991449` |
| `data` | object | ✓ | Event data | |
| `data.sim` | string | ✓ | The eSIM or physical SIM identifier | `"8937204017179541233"` |
| `data.smdpStateChange` | object | ✓ | State change details | |
| `data.smdpStateChange.state` | string | ✓ | The SMDP state. Enum: `"BPP Installation"`, `"Enable"`, `"Disable"`, `"Delete"` | |
| `data.smdpStateChange.modificationResult` | string | ✓ | The result of the state modification | `"SUCCESS"` |

---

# Quick Reference - All Endpoints

## Subscriptions
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v3/subscription` | List Subscriptions |
| POST | `/v3/subscription` | Create Subscriptions |
| GET | `/v3/subscriptions/{iccid}` | Get a subscription |
| DELETE | `/v3/subscriptions/{iccid}` | Delete a Subscription |
| GET | `/v3/subscriptions/{iccid}/plan-attachments` | List plan attachments |
| GET | `/v3/subscriptions/{iccid}/plan-attachments/{plan_id}` | Get a plan attachment |
| POST | `/v3/subscriptions/{iccid}/plan-attachments/{id}/suspend` | Suspend a plan attachment |
| POST | `/v3/subscriptions/{iccid}/send-sms` | Send SMS |
| GET | `/v3/subscriptions/{iccid}/location` | Get subscription location (last known operator) |
| POST | `/v3/subscriptions/{iccid}/network-events` | Get network events (attach + data session debugging, max 7-day window) |

## Plans
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v3/plans` | List plans |
| POST | `/v3/plans` | Create Plans |
| GET | `/v3/plans/{planId}` | Get a Plan |
| DELETE | `/v3/plans/{planId}` | Delete a Plan |
| POST | `/v3/plans/{planId}/archive` | Archive a plan |
| POST | `/v3/plans/{planId}/unarchive` | Unarchive a plan |

## Coverage
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v3/coverage-profiles` | List coverage profiles |
| GET | `/v3/coverage-profiles/{coverageId}` | Get the coverage profile |
| POST | `/v3/coverage-profiles/custom-region` | Create custom region coverage profile |

## SIM
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v3/sims` | List SIMs |
| GET | `/v3/sims/{iccid}` | Get SIM details |
| GET | `/v3/sims/{iccid}/smdp-info` | Get SIM SMDP information |

## Operators
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/v3/operators` | List operators |
| GET | `/v3/operators/{operatorId}` | Get operator |

## Webhook Events
| Method | Event | Description |
|--------|-------|-------------|
| POST | `attachment.allowanceConsumed` | Data allowance consumed |
| POST | `subscription.esim.locationChanged` | SIM location changed |
| POST | `esim.smdp.stateChanged` | SIM SMDP Status Changed |

---

# Labels Reference

The following labels are used throughout the API for plans, coverage profiles, and operators:

| Label |
|-------|
| Green |
| Aqua |
| Blue |
| Voilet |
| Red |
| Grey |
| Orange |

---

# Plan Attachment States

| State | Description |
|-------|-------------|
| `PENDING_FOR_FIRST_USE` | Waiting for first use activation |
| `CREATED` | Plan attachment has been created |
| `ACTIVE` | Plan attachment is currently active |
| `SUSPENDED` | Plan attachment has been suspended |
| `EXPIRED` | Plan attachment has expired |

---

# SMDP States

| State | Description |
|-------|-------------|
| `BPP Installation` | The process of downloading and installing the eSIM profile via a Bootstrap Provisioning Platform |
| `Enable` | eSIM is switched on from device settings, allowing it to connect to the mobile network |
| `Disable` | eSIM is turned off via device settings, temporarily preventing it from being used |
| `Delete` | eSIM profile is completely removed from the device |

---

# Throttling Limits

Available throttling limit values (in Kbit/sec):

| Value | Speed |
|-------|-------|
| `32` | 32 Kbit/sec |
| `64` | 64 Kbit/sec |
| `128` | 128 Kbit/sec |
| `256` | 256 Kbit/sec |
| `384` | 384 Kbit/sec |
| `512` | 512 Kbit/sec |
| `1024` | 1024 Kbit/sec (1 Mbit/sec) |
| `3072` | 3072 Kbit/sec (3 Mbit/sec) |
| `5120` | 5120 Kbit/sec (5 Mbit/sec) |
| `7680` | 7680 Kbit/sec (~7.5 Mbit/sec) |
| `10240` | 10240 Kbit/sec (10 Mbit/sec) |
| `20480` | 20480 Kbit/sec (20 Mbit/sec) |

---

# Recurring Periodicity Types

| Value | Type |
|-------|------|
| `0` | Daily |
| `1` | Weekly |
| `2` | Monthly |

---

**Document Generated:** Complete TelliSIM API v3 Documentation

**Source:** https://api-docs.tellisim.com
