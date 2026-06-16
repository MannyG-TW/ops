# Sapphire Data Plans — Support Knowledge Base

---

# What are Sapphire Data plans

## Overview
Sapphire Data plans (also called FLOW plans) are data packages purchased by customers who **already own** a Sapphire portable hotspot device. Unlike rental customers, these customers bought the device outright and purchase data plans separately when they need connectivity.

**Key facts for support:**
- The customer **already owns** the Sapphire device — no device is shipped with these orders
- Orders contain only a data plan SKU (DHI_*_FLOW*) — there is NO S2G device SKU
- Plans use the **TOTAL_DATA** model (same as eSIM) — a fixed data pool valid for a set number of days
- The plan is loaded onto the device via the device's built-in eSIM or cloud SIM
- The customer's device IMEI is already bound in the UCL system

## How it works
1. Customer purchases a FLOW data plan on the TravelWifi website
2. The plan is provisioned and attached to their device's IMEI/SIM
3. The customer turns on their Sapphire device at the destination
4. The device auto-connects to the local partner network
5. Data countdown begins when the device first connects

## Sapphire Data vs Rental — key differences
| Feature | Sapphire Data (FLOW) | Rental |
|---|---|---|
| Device ownership | Customer **owns** the device | Customer **rents** the device |
| Device shipped? | No — customer has the device | Yes — shipped or picked up |
| Data model | **TOTAL_DATA** (fixed pool) | **DAILY_DATA** (daily allowance) |
| FUP / throttling | **No** — plan dies when data gone | **Yes** — speed reduced, data continues |
| Return required? | No | Yes — return shipping label |
| SKU identifier | Contains `FLOW` | Contains tier name (Adventure/Escape/Voyage) |

## Common confusion
- New reps often see `DHI_` and assume it's a rental. The **FLOW** keyword is the differentiator.
- `DHI_PL_FLOW30GB15DAYS` = Sapphire Data (owner, FLOW)
- `DHI_PL_DP5GB_Escape` = Rental data plan (renter, tier name)
- If there's NO `S2G*` device SKU in the order, it's NOT a rental — it's a Sapphire Data reload

### Search variations
- sapphire data plan
- FLOW plan
- device owner plan
- already own device
- sapphire reload
- buy data for my device
- data plan for sapphire
- what is FLOW
- FLOW vs rental
- sapphire vs rental
- own device data

---

# Sapphire Data plan options

## FLOW plan structure
FLOW plans are sold by **country** with a specific **data amount** and **validity period**. There is no tier system (no Adventure/Escape/Voyage) — just straightforward data packages.

**SKU format:**
```
DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS
```

**Examples:**
- `DHI_PL_FLOW30GB15DAYS` → Poland, 30 GB, 15 days
- `DHI_US_FLOW10GB30DAYS` → USA, 10 GB, 30 days
- `DHI_JP_FLOW5GB7DAYS` → Japan, 5 GB, 7 days
- `DHI_FR_FLOW75GB30DAYS` → France, 75 GB, 30 days
- `DHI_PL_FLOW2GB7DAYS` → Poland, 2 GB, 7 days

## Available plan sizes
Plans vary by country, but common packages include:

| Data | Validity | Typical use case |
|---|---|---|
| 2 GB | 7 days | Light usage, short trip |
| 5 GB | 7-15 days | Moderate browsing, messaging |
| 10 GB | 15-30 days | Standard travel usage |
| 15 GB | 7-15 days | Heavier usage, shorter trip |
| 30 GB | 15-30 days | Extended trip, moderate-heavy usage |
| 50 GB | 30 days | Heavy usage, remote work |
| 75 GB | 30 days | Power user, video streaming |

Not all sizes are available in all countries. The exact catalog depends on the partner network in each destination.

## How FLOW data works (TOTAL_DATA model)
- Customer buys **X GB valid for Y days**
- They can use data at any pace — no daily cap
- **No throttling / No FUP** — when data runs out, the connection stops completely
- Plan ends when either the data is exhausted OR the validity expires, whichever comes first
- Behavior is identical to eSIM plans

## Support talking points
- **"My device says no data"** → Check TelliSIM: plan may be exhausted (remaining_gb < 0.01) or expired. Offer a new FLOW plan.
- **"I just bought a plan but my device still says no data"** → The plan may take a few minutes to provision. Ask the customer to restart their device. If still nothing after 15 minutes, check if the plan was successfully attached to their IMEI.
- **"Can I add more data to my existing plan?"** → Yes, they can purchase another FLOW plan. It will be added to their device.
- **"Is it cheaper than rental?"** → Usually yes for single-destination trips since there's no device rental fee. But they need to already own a Sapphire device.

### Search variations
- FLOW plan options
- how much data
- plan sizes
- available plans
- plan for my country
- data packages
- sapphire plans
- 30GB plan
- 10GB plan
- data amount
- validity period
- how many days

---

# Sapphire Data coverage

## Coverage by region
Sapphire Data FLOW plans are available in the same countries as eSIM and Rental plans. The destination is specified by the country code in the SKU.

## Europe
Albania, Andorra, Austria, Belgium, Bulgaria, Croatia, Cyprus, Czech Republic, Denmark, Estonia, Finland, France, Germany, Greece, Hungary, Iceland, Ireland, Italy, Kosovo, Latvia, Liechtenstein, Lithuania, Luxembourg, Malta, Monaco, Montenegro, Netherlands, North Macedonia, Norway, Poland, Portugal, Romania, Serbia, Slovakia, Slovenia, Spain, Sweden, Switzerland, Turkey, United Kingdom

## Asia and Oceania
**East Asia:** China, Hong Kong, Japan, Macau, Mongolia, South Korea, Taiwan
**Southeast Asia:** Brunei, Cambodia, Indonesia, Laos, Malaysia, Myanmar, Philippines, Singapore, Thailand, Vietnam
**South Asia:** Bangladesh, India, Nepal, Pakistan, Sri Lanka
**Central Asia:** Kazakhstan, Kyrgyzstan, Tajikistan, Uzbekistan
**Middle East:** Bahrain, Iraq, Israel, Jordan, Kuwait, Lebanon, Oman, Palestine, Qatar, Saudi Arabia, Turkey, United Arab Emirates
**Oceania:** Australia, Fiji, New Zealand, Papua New Guinea

## Americas
**North America:** Canada, Mexico, United States, Puerto Rico
**Central America:** Belize, Costa Rica, El Salvador, Guatemala, Honduras, Nicaragua, Panama
**Caribbean:** Antigua and Barbuda, Bahamas, Barbados, Dominican Republic, Jamaica, Trinidad and Tobago
**South America:** Argentina, Bolivia, Brazil, Chile, Colombia, Ecuador, Paraguay, Peru, Suriname, Uruguay, Venezuela

## Africa
**North Africa:** Algeria, Egypt, Morocco, Tunisia
**West Africa:** Benin, Cameroon, Ivory Coast, Gabon, Ghana, Mali, Niger, Nigeria, Senegal, Sierra Leone, Togo
**East Africa:** Ethiopia, Kenya, Madagascar, Malawi, Mauritius, Mozambique, Rwanda, Tanzania, Uganda
**Southern Africa:** Botswana, Eswatini, Namibia, South Africa, Zambia, Zimbabwe

## Coverage notes
- FLOW plans are single-country only — each plan covers one destination
- To use in multiple countries, the customer needs separate FLOW plans per country
- The device auto-connects to the partner network when powered on at the destination
- First connection in a new country may take up to 10 minutes

### Search variations
- sapphire coverage
- FLOW coverage
- which countries sapphire
- does FLOW work in
- sapphire in europe
- sapphire in japan
- sapphire in usa
- sapphire countries
- available destinations

---

# Sapphire device models

## Supported devices
Sapphire Data plans work with any Sapphire-branded portable hotspot device. The device model is identified by the UCL `terminalType` code.

## Device lineup
| Terminal Code | Marketing Name | Notes |
|---|---|---|
| G2 | Sapphire G2 | Compact 4G hotspot |
| G3 | Sapphire G3 | Mid-range 4G hotspot |
| G4 | Sapphire G4 | Premium 4G/5G hotspot |
| E1 | Sapphire E1 | Entry-level model |
| U2 | Sapphire U2 | Also known as U2S in some markets |
| U3 | Sapphire U3 | Updated design |
| U3Q19 | Sapphire U3 (Q19) | Hardware revision of U3 |
| U50 | Sapphire 5G | 5G-capable premium device |

## How to identify the device
1. **From the order/UCL:** The `terminalType` field shows the device code (G2, G3, E1, etc.)
2. **From the IMEI:** The first 8 digits (TAC prefix) can identify the device model
3. **Physically:** The device model is usually printed on the back or under the battery cover

## Device binding
- Each Sapphire device is **bound** to a customer account via its IMEI in the UCL system
- The binding status can be: `BINDING` (active) or `BINDED` (has been used)
- FLOW plans are provisioned to the device's bound SIM/eSIM profile
- If a customer buys a new device, it needs to be bound before plans can be loaded

### Search variations
- sapphire device
- which device
- device model
- G2
- G3
- G4
- E1
- U2
- U3
- U50
- 5G device
- terminal type
- device IMEI
- device binding
- bound device

---

# Sapphire Data SKU format

## How to read FLOW SKUs
FLOW SKUs follow this pattern:
```
DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS
```

Breaking it down:
- `DHI` — prefix for all Sapphire/rental plans (stands for the partner network identifier)
- `{COUNTRY}` — ISO2 country code (PL, US, JP, FR) or region name (Europe, SEAsia)
- `FLOW` — identifies this as a Sapphire Data plan (NOT a rental tier)
- `{GB}GB` — data amount in gigabytes
- `{DAYS}DAYS` — validity period in days

## SKU examples decoded
| SKU | Country | Data | Validity |
|---|---|---|---|
| `DHI_PL_FLOW30GB15DAYS` | Poland | 30 GB | 15 days |
| `DHI_US_FLOW10GB30DAYS` | USA | 10 GB | 30 days |
| `DHI_JP_FLOW5GB7DAYS` | Japan | 5 GB | 7 days |
| `DHI_FR_FLOW75GB30DAYS` | France | 75 GB | 30 days |
| `DHI_TH_FLOW2GB7DAYS` | Thailand | 2 GB | 7 days |
| `DHI_DE_FLOW15GB7DAYS` | Germany | 15 GB | 7 days |

## Legacy SKU variants
Some older SKUs may include a version number and/or date suffix:
```
DHI_{COUNTRY}_FLOW{GB}GB{DAYS}DAYS{VERSION}_{DATE}
```
Example: `DHI_PL_FLOW2GB7DAYS2_20220101`
- The `2` after DAYS is a plan version number
- The `_20220101` is a date stamp (when the plan was created/updated)
- These extra fields do not affect the data amount or validity

## Quick identification: Is it FLOW or Rental?
| Check | FLOW (Sapphire Data) | Rental |
|---|---|---|
| SKU contains `FLOW` | Yes | No |
| SKU contains `Adventure/Escape/Voyage/UNLIMITED` | No | Yes |
| Order has `S2G*` device SKU | No | Yes |
| Data model | TOTAL_DATA | DAILY_DATA |

### Search variations
- FLOW SKU
- sapphire SKU
- DHI FLOW
- how to read FLOW
- SKU format
- what does DHI mean
- legacy SKU
- old format
- plan version

---

# Troubleshooting — Sapphire Data plans

## Plan purchased but device shows no data
1. **Wait 5-10 minutes** — provisioning can take time, especially for first-time activation in a new country
2. **Restart the device** — power off completely, wait 30 seconds, power on
3. **Check plan status** in TelliSIM:
   - `PENDING` → Plan provisioned but not yet activated on the network. Customer needs to be at the destination
   - `ACTIVE` → Plan is live — device should have data. Restart device if still not working
   - `EXPIRED` → Plan has ended — customer needs a new FLOW plan
4. **Verify IMEI binding** — the plan must be provisioned to the correct device IMEI. Check UCL binding status
5. **Check coverage** — the customer must be in the country specified by the FLOW plan

## Device won't connect to network
- Same troubleshooting as rental devices — see the U2S or device-specific KB for hardware troubleshooting
- Check LED indicators: Signal LED should show bars
- Move to an area with better cellular coverage
- Restart the device
- If the device connects to WiFi (via admin page at 192.168.43.1) but has no cellular data, the plan may not be loaded or the SIM may have an issue

## Plan expired sooner than expected
- FLOW plans use TOTAL_DATA — the plan dies when data runs out OR validity expires
- Check CDR consumption: if the customer burned through all data before the validity date, this is normal
- Common cause: a family sharing the device can burn 30 GB in just a few days with streaming
- Offer a new FLOW plan purchase

## Customer has old/expired plans piling up
- Old plans remain visible in TelliSIM but are inactive
- The device uses the most recent active plan
- Expired plans do not interfere with new plans
- Multiple active plans: the system picks the one with the most recent `created_at`

## Device shows "BINDING" vs "BINDED"
- `BINDING` → Device is currently active/bound to the customer
- `BINDED` → Device has been used (bound at least once — this is the normal active state)
- Both states are fine for FLOW plan loading
- If binding status is missing or shows an error, the device may not be properly registered — escalate to UCL ops

### Search variations
- FLOW not working
- sapphire no data
- plan not loading
- device no connection
- data not showing
- purchased but no data
- expired too soon
- binding issue
- IMEI not bound
- device won't connect
- troubleshoot sapphire
- troubleshoot FLOW

---

# Frequently asked questions — Sapphire Data

## Where can I buy a Sapphire device?
Sapphire devices are sold through TravelWifi and authorized partners. Support reps should direct customers to the TravelWifi website for device purchases. We do not sell devices through the support channel.

## Can I use my Sapphire device with a local SIM instead of FLOW?
Yes. Sapphire devices have a physical SIM card slot (Micro SIM). Customers can insert a local SIM purchased at their destination. However:
- The device must be powered off before inserting/removing a SIM
- APN settings may need manual configuration for local SIMs
- FLOW plans use the device's built-in cloud SIM — no physical SIM needed

## Can I share my FLOW data with others?
Yes. The Sapphire device creates a WiFi hotspot — anyone can connect using the WiFi name and password on the device label. Multiple devices (phones, laptops, tablets) can connect simultaneously.

## How do I check my remaining data?
- Support can check via TelliSIM lifecycle: `remaining_gb` field
- The device itself may show data usage on its display or admin page (192.168.43.1) depending on the model
- There is currently no customer-facing app to check remaining FLOW data

## Can I use FLOW plans in multiple countries?
- Each FLOW plan covers **one country only**
- To use data in a different country, the customer needs a separate FLOW plan for that country
- The customer can purchase multiple FLOW plans for different destinations
- The device will auto-connect to the correct plan when powered on at each destination

## How long does it take for a new plan to activate?
- After purchase, the plan is typically provisioned within **5-15 minutes**
- The customer should restart their device after purchasing
- First-time activation in a new country may take up to **10 minutes** for network registration
- If nothing happens after 20 minutes, check TelliSIM status and IMEI binding

## Can I cancel a FLOW plan?
- If the plan has **not been activated** (PENDING state, 0 bytes used) — may be eligible for cancellation/refund
- If the plan has been **partially used** — review on a case-by-case basis
- Standard refund policies apply — check order status and consumption before processing

## My device is very old — will new FLOW plans still work?
- FLOW plans work with all supported Sapphire device models (G2, G3, G4, E1, U2, U3, U50)
- Older devices may not support 5G networks but will work on 4G/LTE
- If the device firmware is very outdated, it may need a firmware update (all LEDs flashing = update in progress)
- Very old devices that are no longer in the supported lineup may have compatibility issues — check with UCL ops

### Search variations
- FAQ sapphire
- buy device
- local sim sapphire
- share data sapphire
- check remaining data
- multiple countries sapphire
- activation time
- cancel FLOW plan
- refund FLOW
- old device
- firmware update
- compatible device
