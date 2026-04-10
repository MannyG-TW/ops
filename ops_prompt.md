Project: Internal Customer Support Operations Tool
Build a fast, modern, internal-only web application for our 15–20 customer support agents who work 24/7 across time zones. The tool must be built with Next.js 15 (App Router), TypeScript, Tailwind CSS, and shadcn/ui components. Deploy-ready for AWS.
MANDATORY FILES TO READ:

Strictly follow branding.md for all logos, colors, fonts, spacing, and visual style.
Reference the latest hardware API documentation MD file for all rental device endpoints and data flows.

Authentication

Email + 2FA code sent via Mailgun.
“Remember this device” checkbox with options: 3 hours, 6 hours, or 12 hours.
Role-based access control with dynamic roles (admin can create any role name).

User & Role Management (Admin only)

Full CRUD for users and custom roles with permission settings.

Global Search

Always-visible top search bar that instantly queries OpenSearch by: order ID, IMEI, serial number, ICCID, phone number, or email.

Main Dashboard

Clean, glanceable layout with:
Fraud Watch section (prominent red/yellow alerts)
Shift Awareness cards (auto-generated)
Manager Broadcast Wall
Recent Activity Feed (live team actions)
Quick links to key sections


Customer Profile Page

Unified view for eSIM, Travel WiFi rentals, and Sapphire hotspots.
Order details, data usage, plan expiry, CDRs, device status, signal strength.
Threaded internal notes with @mentions (users or roles).
Ability to link or create Zendesk ticket and pull existing ticket notes via Zendesk API.
Quick action buttons: Pause Service, Block Purchases, Resend Activation Email, Escalate to Supervisor, Flag as Fraud.
Saved Replies library (agents can save and insert common responses).

Fraud Watch System

Any agent can flag an order as “Fraud” from the customer profile.
System records key identifiers (email, phone, name, last 4 of credit card).
Prominent Fraud Alert banner on the dashboard visible to every logged-in agent.
Automatic background job that scans OpenSearch every 3–5 minutes for new matching orders.
Clear alert cards showing matched customer info and occurrence count.
Dedicated manager view showing full fraud history and flagged orders.

Shift Awareness & Manager Broadcast

System automatically analyzes last 12–24 hours of data from OpenSearch (and Zendesk when ticket is linked) and generates “Shift Awareness” cards (e.g., spikes in cancellations, refunds, complaints by country or product).
Manager-only “Broadcast Wall” where supervisors can post important messages that appear on every agent’s dashboard on login.

Bulk IMEI/ICCID Analyzer (Reports Section)

Agents can add single IMEI/ICCID or upload CSV list.
Provide downloadable template and full validation (existence check, duplicate removal, invalid format alerts).
Date range selector.
Pull daily data consumption, show clean per-day table + totals + average per device.
Export as PDF or send via Mailgun email.
Progress modal with live status for long-running processes.

Product Knowledge Base

Local database for every SKU/product.
Fields: multiple images, setup guides, troubleshooting steps, compatibility info (especially eSIM phone compatibility).
Admin can easily add, edit, or remove products.

Payments

Stripe integration: generate payment links for extensions, handle webhooks to auto-process orders and send confirmations.

Email

All emails (2FA, payment links, reports, confirmations) sent via Mailgun.
All Mailgun credentials and settings configurable from the UI Settings page.

Settings Page (Admin only)

Secure page to update and save all API keys, tokens, Mailgun config, database connections, etc. Store encrypted in the database — never hardcode anything.

Additional Features

Recent Activity Feed (live sidebar of team actions).
Saved Replies library.
Escalation button that notifies supervisors and opens the profile for them.
Progress modals with status and progress bar for any long-running action (upload, scraping, bulk analysis, etc.).

UI/UX & Technical Rules

Full light and dark mode with user toggle.
Strict WCAG contrast compliance — never use light text on light backgrounds or dark text on dark backgrounds.
No browser alerts or pop-ups ever — use clean modals for all confirmations and messages.
Every long-running process must show a modal with progress bar and real-time status.
Extremely fast loading, mobile-friendly, minimal clutter, designed for agents on phone calls.
All data reads should prioritize OpenSearch for speed. Use APIs and scraping only when needed.

Build this as a complete, well-structured, production-ready application with proper folder organization, error handling, loading states, and responsive design.
