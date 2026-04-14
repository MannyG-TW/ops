# TravelWifi Ops — Answers & Decisions

**Date:** 2026-04-10
**Source:** Manny's responses to QUESTIONS.md

---

## Key Architecture Decisions

### External Integrations
- **Zendesk, Stripe, Mailgun**: Deferred to the end. Not needed for initial build.

### Authentication
- Email-only login, no password. Admin creates accounts.
- 2FA code sent via email (Mailgun) to login.
- RBAC assigned per user in the User Management UI.
- Roles/permissions are configurable by admin.

### Data Architecture
- **Read-only system** for now. Can pull and query but no writes to external systems initially.
- **Local data caching**: Save data locally to make things faster, but this is NOT the source of record.
- **Data retention**: Forever. No deletion requirements.
- **Customer identifier**: `customer_email` is the only cross-system identifier.
- **Deployment**: AWS.

### OpenSearch
- OS URL, username, and password configured from the **Settings page** in the UI.
- Password saved locally (encrypted).
- CDR data comes from OS indices — already set up and configured, no changes needed.
- The ops tool queries existing indices as-is.
- Understanding the indices and how each maps to each product is critical.

### TelliSIM API
- API key configured from the **Settings page**.
- Use **all available endpoints** documented in the TelliSIM API v3 documentation.
- Read-only initially, write operations (suspend, etc.) added later.

### uCloudlink (UCL)
- **Never connect to SFTP**. Only consume UCL CDR data from OpenSearch indices.
- There is a UCL API for creating connections — will be provided later.

### Fraud Detection
- **Single rule**: When a customer support agent marks an order as "Fraud" from the customer profile.
- A **cron job** starts scanning OpenSearch for all orders matching the flagged person's:
  - Name
  - Email
  - Credit card (last 4 digits)
  - Phone number
- A **Fraud Watch view** is created showing all matching orders.
- Scan frequency is configurable by managers in settings (every 5 min, 10 min, etc.).

### Refunds
- Refund capability is a **permission** assigned to users via RBAC.
- Refund amount = what the customer actually paid.
- If a discount or coupon was applied, we do NOT refund the discount portion — only the amount charged.
- This rule applies to CMRPuntos as well.

### Scope
- This is a **new, standalone tool** — not replacing anything.
- Purpose: A support tool for customer support agents to provide support to customers.
- Products: eSIMs, Rentals, Sapphire Hotspots, and Data Plans.
- Product logic is explained in the existing MD documentation files.

---

## What This Means for Development

### Priority Order
1. OpenSearch integration (Settings → connect → query indices)
2. Product understanding (map indices to products per the docs)
3. Customer lookup (by email, ICCID, IMEI, order ID)
4. CDR display (from OS indices, mapped per product type)
5. Fraud watch (flag → cron scan → matching view)
6. TelliSIM API integration (all endpoints, read-only first)
7. Refund logic (permission-based, actual amount paid only)
8. Zendesk/Stripe/Mailgun (deferred)

### Resolved Questions from QUESTIONS.md
- Q1-15 (Zendesk/Stripe/Mailgun): **Deferred**
- Q16-19 (Auth): **Email + 2FA, admin-created accounts, RBAC in UI**
- Q20-28 (OpenSearch): **Query indices as-is, configure from Settings**
- Q29-36 (TelliSIM): **All endpoints, configured from Settings, read-only first**
- Q37-40 (UCL): **OS indices only, never SFTP**
- Q41-48 (SKU/Products): **Follow the MD documentation logic**
- Q49-54 (Fraud): **Single rule: agent flags → cron scans → matching view**
- Q55-57 (Refunds): **Permission-based, refund = amount paid minus discounts**
- Q58-61 (Pricing/GP): **Read-only display from OS data**
- Q62-66 (Customer Model): **Email is the only identifier**
- Q67-72 (CDR/Billing): **Use OS indices as configured**
- Q73-78 (Infrastructure): **AWS, OS configured from UI**
- Q79-80 (Retention): **Forever**
- Q81-85 (Scope): **New standalone support tool, read-only initially**
