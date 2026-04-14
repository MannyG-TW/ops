@AGENTS.md

# TravelWifi Ops - Internal Customer Support Operations Tool

## Dev Server

- **Port**: 5000 (never use 3000)
- **Start**: `./scripts/start.sh` (kills existing, clears cache, starts dev server)
- **Stop**: `./scripts/stop.sh` (kills process, clears .next cache)

## Stack

- Next.js 15 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- Design system: Superhuman-inspired (see design.md)

## Design Rules

- Border radius: ONLY 8px and 16px
- Font weights: 460 (body), 540 (display), 600 (semi), 700 (bold)
- Colors: mysteria, lavender, charcoal, amethyst, cream, parchment
- Icons: Lucide React only, never emojis
- Buttons: Warm Cream (#e9e5dd) primary, not bright CTAs

## 2FA Login

- Dev/Staging: code shown on screen (NEXT_PUBLIC_APP_ENV != "production")
- Production: code sent via Mailgun email (NEXT_PUBLIC_APP_ENV=production)
