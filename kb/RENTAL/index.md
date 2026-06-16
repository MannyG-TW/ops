# Rental Data Plans — Support Knowledge Base

---

# What is a TravelWifi rental

## Overview
A TravelWifi rental is a portable WiFi hotspot device that customers rent for their trip. The device comes pre-configured with a data plan and connects to local cellular networks, creating a personal WiFi hotspot that the customer's phone, laptop, and other devices connect to.

**Key facts for support:**
- This is a **physical device** that is shipped to the customer (or picked up at an airport counter)
- The device must be **returned** after the rental period ends
- Rental plans use the **DAILY_DATA** model — data resets every day at midnight
- The device creates a WiFi hotspot — up to 5-10 devices can connect simultaneously
- The customer does NOT need an eSIM-compatible phone — any WiFi-capable device works
- Every valid rental order has **two SKUs**: a device SKU (S2G*) and a data plan SKU (DHI_*_tier)

## What the customer receives
1. A **Sapphire portable hotspot device** (pre-configured, charged)
2. A **Micro USB charging cable**
3. A **return shipping label** (for sending the device back)
4. The WiFi network name and password are printed on the device label

## Rental vs eSIM — when to recommend which
| Scenario | Recommend |
|---|---|
| Customer has an eSIM-compatible phone, traveling solo | **eSIM** — simpler, no device to carry or return |
| Group travel (family, colleagues) | **Rental** — one device, everyone connects |
| Customer's phone doesn't support eSIM | **Rental** — works with any WiFi device |
| Customer wants unlimited data with no speed worries | **Rental Unlimited** — no data cap |
| Customer needs to connect laptops/tablets | **Rental** — hotspot connects all devices |
| Short trip, light data usage | **eSIM** — cheaper for single-user light usage |

### Search variations
- what is rental
- travel wifi device
- portable hotspot
- pocket wifi
- mifi device
- wifi rental
- how does rental work
- what do I receive
- what's in the box
- rental vs esim
- should I rent or buy esim

---

# Rental data plan tiers

## How rental data works — DAILY_DATA model
Rental plans work differently from eSIM plans. Instead of a fixed total pool of data, rental customers get a **daily allowance** that **resets every midnight** (local time at the destination).

**Key differences from eSIM (TOTAL_DATA):**
- Data resets daily — the customer gets a fresh allowance every day
- If the customer exceeds their daily cap, **speed is reduced** (Fair Usage Policy / FUP) but data **continues** — the connection does NOT stop
- At midnight, full speed is restored
- The plan ends when the rental period ends (not when data runs out)

## The four tiers

### Adventure (entry-level)
- **Daily allowance:** Smallest data cap per day
- **Best for:** Light users — email, messaging, maps, light browsing
- **FUP:** Speed reduced after daily cap is reached; resets at midnight
- **Typical use case:** Budget travelers who mostly use WiFi at hotels and only need mobile data for navigation and messaging

### Escape (most popular)
- **Daily allowance:** 5 GB per day at full speed
- **Best for:** Standard travelers — social media, video calls, moderate streaming
- **FUP:** Speed reduced after 5 GB/day; resets at midnight
- **Typical use case:** The default recommendation for most customers. Covers normal daily usage including social media, navigation, video calls, and occasional streaming

### Voyage (premium)
- **Daily allowance:** Larger data cap per day (more than Escape)
- **Best for:** Heavy users — HD video streaming, large uploads, remote work
- **FUP:** Speed reduced after daily cap; resets at midnight
- **Typical use case:** Business travelers who need to video conference, remote workers, content creators uploading photos/videos

### Unlimited (no cap)
- **Daily allowance:** No daily cap — truly unlimited data
- **No FUP** — speed is never reduced
- **Best for:** Power users, groups sharing one device, anyone who doesn't want to think about data limits
- **Typical use case:** Families sharing the device, groups on tour buses, customers streaming content all day

## Tier comparison
| Tier | Daily Data | FUP (throttling) | Typical customer |
|---|---|---|---|
| **Adventure** | Smallest | Yes, speed reduced after cap | Budget / light user |
| **Escape** | 5 GB/day | Yes, speed reduced after 5 GB | Standard traveler |
| **Voyage** | Large | Yes, speed reduced after cap | Heavy user / remote work |
| **Unlimited** | No cap | No throttling | Power user / groups |

## Support talking points
- **"My speed got slow this afternoon"** → Customer likely hit the daily FUP cap. Tell them speed will restore at midnight. This is expected behavior for Adventure/Escape/Voyage tiers. Do NOT refund — this is by design.
- **"It says unlimited but my speed dropped"** → If this is a Voyage customer, they hit the cap. If truly Unlimited tier, this should NOT happen — escalate to investigate network issues.
- **"When does my data reset?"** → Every midnight local time at the destination.
- **"Can I upgrade my tier mid-trip?"** → Not currently supported mid-rental. Customer would need a new rental order.

### Search variations
- rental tiers
- adventure plan
- escape plan
- voyage plan
- unlimited plan
- daily data
- how much data per day
- daily allowance
- data reset
- midnight reset
- FUP
- fair usage policy
- throttling
- speed reduced
- slow after cap
- which tier
- upgrade tier
- tier comparison
- 5GB per day

---

# Rental SKU format

## How to read rental SKUs
Every valid rental order contains **two** SKUs — a device SKU and a data plan SKU. One without the other is an invalid order — escalate to ops.

## Device SKUs
The device SKU identifies the physical hotspot being rented:

| SKU | Description |
|---|---|
| `S2GLOCALMERENT` | Standard rental device (99% of rentals) |
| `S2GLOCALMEBLACKMATTE` | Black matte color variant |
| `S2GLOCALMEBLACKGLOSSY` | Black glossy color variant |
| `S2GLOCALMEGREEN` | Green color variant |
| `S2GLOCALMEMAGENTA` | Magenta color variant |
| `S2GLOCALMEBLUE` | Blue color variant |

**Key:** All device SKUs start with `S2G`. If you see S2G in the SKUs, it's a rental.

## Data plan SKUs
The data plan SKU specifies the country/region and tier:

**Tiered plans:**
```
DHI_{COUNTRY_OR_REGION}_DP{GB}GB_{TIER}
```
Examples:
- `DHI_Europe_DP5GB_Escape` → Europe, Escape tier (5 GB/day)
- `DHI_FR_DP10GB_Voyage` → France, Voyage tier
- `DHI_US_DP1GB_Adventure` → USA, Adventure tier

**Unlimited plans:**
```
DHI_{COUNTRY}_DPUNLIMITED
DHI_{COUNTRY}_DPUNLIMITED{DAYS}DAYS
```
Examples:
- `DHI_PL_DPUNLIMITED` → Poland, Unlimited
- `DHI_KW_DPUNLIMITED30DAYS` → Kuwait, Unlimited, 30 days

## Identifying a rental order
1. Look for `S2G` prefix in the SKUs → confirms physical device (rental)
2. Look for `DHI_` prefix with `Adventure`, `Escape`, `Voyage`, or `UNLIMITED` → confirms rental data tier
3. **Both must be present** for a valid rental order

## Common confusion: Rental vs Sapphire Data
- `DHI_*` with `Adventure/Escape/Voyage/UNLIMITED` + `S2G*` device → **RENTAL** (customer is renting)
- `DHI_*` with `FLOW` and NO `S2G*` device → **SAPPHIRE DATA** (customer owns the device)
- The `FLOW` keyword is the tell — FLOW = owner, tier names = renter

### Search variations
- rental SKU
- S2G
- S2GLOCALMERENT
- device SKU
- plan SKU
- DHI adventure
- DHI escape
- DHI voyage
- DHI unlimited
- how to read SKU
- what does SKU mean
- invalid rental
- missing device SKU

---

# Rental coverage

## Coverage by region
Rental plans are available with the same country coverage as eSIM plans. The destination is specified in the data plan SKU.

**Single-country rental plans** cover one specific country:
- `DHI_FR_DP5GB_Escape` → France only
- `DHI_US_DP10GB_Voyage` → USA only
- `DHI_JP_DP5GB_Escape` → Japan only

**Regional rental plans** cover multiple countries:
- `DHI_Europe_DP5GB_Escape` → Multiple European countries with one device
- `DHI_SEAsia_DP5GB_Escape` → Southeast Asian countries

## Popular rental destinations
**Europe:** France, Germany, Italy, Spain, UK, Netherlands, Switzerland, Portugal, Greece, Turkey, Austria, Belgium, Czech Republic, Croatia, Poland, Sweden, Norway, Denmark, Ireland, Iceland
**Asia:** Japan, South Korea, Thailand, Singapore, Malaysia, Indonesia, Vietnam, Philippines, Hong Kong, Taiwan, China, India
**Americas:** USA, Canada, Mexico, Brazil, Argentina, Colombia, Costa Rica
**Oceania:** Australia, New Zealand
**Middle East:** UAE, Saudi Arabia, Qatar, Kuwait, Bahrain, Israel, Jordan

## Coverage notes for rentals
- The rental device auto-connects to partner networks in the covered country
- For regional plans, the device seamlessly switches networks when crossing borders
- Coverage is the same quality as eSIM — the device uses the same cellular networks
- Connection time: 1-2 minutes normally, up to 10 minutes first time in a new country
- Rural/remote areas may have weaker signal — same as any mobile device

### Search variations
- rental coverage
- which countries rental
- rental in europe
- rental in japan
- rental in usa
- does rental work in
- regional rental
- single country rental
- multi country rental
- where can I use rental

---

# Rental device return

## Return process
The rental device must be returned after the rental period ends. A **return shipping label** is included with the device.

**How to return:**
1. Power off the device
2. Place the device, charging cable, and any accessories back in the original packaging (or any padded envelope)
3. Attach the pre-paid return shipping label
4. Drop it off at the designated courier (varies by market — DHL, FedEx, local postal service, or airport drop-off point)
5. Return within **5 days** of the rental end date

## Late return
- Returns received after 5 days may incur a **late fee**
- If the device is not returned within 30 days, the customer may be charged the **full device replacement cost**

## Damaged or lost device
- If the device is **damaged** (cracked screen, water damage, broken buttons): customer may be charged a damage fee
- If the device is **lost or stolen**: customer should report it immediately so TravelWifi can unbind the device. A replacement charge may apply.
- Lost device procedure: unbind the IMEI through UCL portal

## Airport drop-off
Some markets offer airport drop-off boxes:
- The customer drops the device in a TravelWifi collection box at the departure terminal
- Available at select major airports — check availability for the specific market

### Search variations
- return device
- how to return
- send back
- shipping label
- return label
- late return
- late fee
- lost device
- damaged device
- broken device
- stolen device
- airport drop off
- when to return
- return deadline

---

# Troubleshooting — rental device

## Device won't turn on
1. **Charge the device** — plug in via Micro USB cable for at least 15 minutes, then try again
2. **Check the cable** — try a different Micro USB cable if available
3. **Force restart** — press and hold the power button for 10+ seconds
4. If the device still won't turn on after charging for 30 minutes, the battery may be dead — replacement device needed

## Device is on but no WiFi network appears
1. Check LED indicators — the WiFi LED should be solid or blinking
2. Press the power button briefly to wake the display/LEDs
3. **Restart the device** — hold power button for 3 seconds, wait for it to power off, then turn back on
4. If WiFi LED is off, the WiFi module may have crashed — force restart (hold power 10 seconds)

## WiFi connected but no internet
1. Check the **Signal LED** — if no bars, the device has no cellular connection
2. Wait 1-2 minutes — the device may still be connecting to the network (up to 10 minutes in a new country)
3. **Restart the device** — this is the most effective fix for connection issues
4. Move to an area with better signal (near a window, away from underground areas)
5. Check if the data plan is active — the plan must be loaded and within the rental dates
6. Reset the device: use the reset pinhole button with a paperclip (brief press, NOT long press which is factory reset)

## All LEDs flashing simultaneously
- This indicates a **firmware update** is in progress
- Do NOT turn off the device during a firmware update
- Wait 5-10 minutes for the update to complete
- The device will restart automatically when done

## Slow speeds during the day
- The customer likely hit their **daily FUP cap**
- Check which tier they're on (Adventure/Escape/Voyage)
- Escape tier: speed reduces after 5 GB in one day
- Speed will restore at **midnight local time**
- This is NOT a device defect — it's normal FUP behavior

## Can't connect more than X devices
- The device supports 5-10 simultaneous WiFi connections (varies by device model)
- If the limit is reached, disconnect unused devices
- Some devices have a setting to increase the connection limit via the admin page (192.168.43.1)

## Battery draining too fast
- Normal battery life is approximately 10-12 hours of active use
- **Reduce connected devices** — each connected device drains battery faster
- **Turn off the device** when not in use (on a train, sleeping, etc.)
- Keep the device charged overnight using the included Micro USB cable
- Avoid leaving the device in direct sunlight or extreme heat — this degrades battery performance

## WiFi name and password
- WiFi network name format: **Tep_XXXXXX** (printed on the device label)
- Default password: printed on the device label (same sticker as the WiFi name)
- To change WiFi name/password: connect to the device and go to **192.168.43.1** in a browser
- If the customer forgot the password and can't access the admin page, a factory reset will restore defaults (but consult support first)

## Local SIM usage
The rental device has a SIM card slot that customers can use for a local SIM if desired:
- The device accepts **Micro SIM** only (not Nano SIM)
- **Turn off the device** before inserting or removing a SIM
- APN may need to be configured manually for local SIMs
- The pre-loaded TravelWifi plan takes priority — local SIM is optional

### Search variations
- device not working
- won't turn on
- no wifi
- can't see wifi
- no internet
- slow speed
- FUP throttle
- battery life
- battery draining
- how many devices
- device limit
- wifi password
- wifi name
- tep password
- LEDs flashing
- firmware update
- reset device
- local sim
- sim card slot
- troubleshoot rental

---

# Frequently asked questions — Rental

## Do I need to download an app?
No. The rental device works out of the box with no app, no account creation, and no configuration needed. Just turn it on and connect via WiFi.

## Can I use the device on a plane?
The device must be in **airplane mode or turned off** during flights, same as any cellular device. It will not work mid-flight. Turn it on after landing.

## Can I use the device in multiple countries?
- **Single-country plans:** Only in the specified country
- **Regional plans:** Yes — the device auto-switches networks when crossing borders. Allow 5-10 minutes for connection in a new country.

## What if the device runs out of battery while I'm out?
The device can be charged via any Micro USB power source — a portable power bank works perfectly. The device continues to provide WiFi while charging.

## Can I extend my rental?
Contact support to extend the rental period. An additional data plan charge will apply for the extra days. The same device continues to work.

## What happens if I go over my daily data limit?
For Adventure, Escape, and Voyage tiers: your speed is **reduced** (throttled) for the rest of the day, but the connection **continues working**. At midnight, full speed is restored. For Unlimited tier: there is no cap and no throttling.

## Can someone else use my rental device?
Yes. Anyone can connect to the device's WiFi using the network name and password on the label. There's no account or identity tied to the WiFi connection. Share it with travel companions freely.

## What if I'm traveling with a group — one device or multiple?
One device is usually sufficient for 2-4 people with moderate usage. For larger groups or heavy users, consider:
- Upgrading to Voyage or Unlimited tier for more daily data
- Renting multiple devices (each traveler gets their own)
- Note: more connected devices = faster battery drain

### Search variations
- FAQ rental
- do I need an app
- use on plane
- airplane
- flight
- multiple countries rental
- battery portable
- power bank
- extend rental
- over daily limit
- share device
- group travel
- multiple devices
- how many people
