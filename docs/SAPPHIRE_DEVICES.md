# Sapphire Devices & Plan Types

Reference for customer-support operators and anyone auditing Sapphire Data consumption.

---

## Key concept — plans follow the user, not the device

A Sapphire data plan attaches to the **UCL sub-user account** (the customer's email), not the IMEI. If a customer:

1. Buys Device A, binds it, purchases a 10 GB USA plan, uses 4 GB.
2. Rebinds to Device B (after upgrade or replacement).

Then the remaining 6 GB follows them to Device B. A sub-user can be bound to **one device at a time** — binding transfers, plans don't reset.

Implications for troubleshooting:

- Always resolve the user first (email → UCL `customerName`).
- When auditing usage, aggregate CDR across **every IMEI that user has ever been bound to**, not just the current one.
- UCL does not expose a binding history API — reconstruct from CDR records keyed by the user's `customerId`.

Reference: UCL Interface Spec v2.9 §4.6 (`GrpCreateOrder` — plan attaches to `userCode`), §4.7 (`QueryUserOfferList`), §5.4/5.5 (binding is a separate, mutable relationship).

---

## Plan types (UCL `pkType`)

Not every plan the customer has was sold. Two categories matter for billing audits:

| `pkType` | Display label | Source | Notes |
|---|---|---|---|
| `SWTC` | **Purchased** | Sale through our storefront | Has a non-null UCL `orderId` and a matching order in OpenSearch. |
| `CSTC` | **Pre-loaded** | Factory/device-bundled allowance | Auto-provisioned when a 5G-capable device is first bound. `orderId` is `None`. Do **not** treat as a leak. |

There are other `pkType` values in the UCL spec (e.g. top-up bundles) that we haven't catalogued yet — extend this table as we encounter them.

### The 5G pre-loaded allowance

The Sapphire U50 (and other 5G devices in the same family) ships with a **5 GB pre-loaded plan** named `DHI_ALL_ORIGINAL5GB_20241129` / "5GB pre-loaded plan for the 5G devices". Characteristics:

- `pkType: CSTC`
- `orderId: None` (no sale)
- `activeType: AUTO` — activates the moment the device comes online
- `flowByte: 5120` MB, `areaFlag: ROAMING`
- Effective for ~14 days from binding

This allowance is **expected** usage. If a new customer's first few days of usage come out of this plan, that's the product working as designed. Don't raise it as an overage.

---

## Terminal types seen in the field

UCL returns `terminalType` (e.g. `G2`, `U3Q19`, `U50`) from `QueryBindingRelationInfo`. Map these to marketing names + assets in **Settings → Sapphire Devices**.

| `terminalType` | Family | Notes |
|---|---|---|
| `U50` | 5G | Ships with the 5 GB CSTC allowance. Marketing name TBD — set in Settings. |
| `U3Q19` | TBD | Seen in the field; marketing name TBD. |
| `G2`, `G3`, `G4` | Older hotspot line | Marketing names TBD. |

Unknown terminal types show as **"unmapped"** in the device card — add them in Settings.

---

## Investigation playbook

When a Sapphire customer reports a problem (no service, unexpected bill, overage):

1. Open the customer's record by email.
2. Open the order they're asking about. Note the IMEI and trip window.
3. Click the IMEI — the device card loads the UCL binding + CDR + full offer list.
4. Cross-check:
   - Is the usage shown > the *selected plan's* cap? Or is it total across multiple plans?
   - Any pre-loaded (`CSTC`) plan in the list? That explains "free" usage.
   - Does UCL's `surplusFlowbyte` roughly match `plan.cap - cdr.sum(flowsize)` for the plan window? If delta is large, open a ticket against UCL / ETL.
5. If an offer in UCL has no matching OpenSearch order **and** `pkType` is not `CSTC`, escalate — that's a candidate leak.
