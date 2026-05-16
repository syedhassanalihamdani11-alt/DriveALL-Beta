# DriveAll — Product Requirements Document

## Original Problem Statement (verbatim)
**DriveAll** is a production-grade ride-hailing platform designed for Azad Kashmir and similar rural/mountain regions. It enables hyper-local ride matching, fare negotiation, real-time tracking, and direct communication between drivers and riders. Optimized for low network areas, village-level transport, flexible pricing, real-world cash economy. Multilingual (Roman Urdu + English), dark/light theme, map-first interface, zero commission model.

## User Choices (recorded session 1)
- **Tech stack**: React + FastAPI + MongoDB (mobile-first responsive web app / PWA).
- **Auth**: Emergent-managed Google OAuth (Phone OTP deferred to v2).
- **Maps**: Leaflet + OpenStreetMap (free, no API key — well-suited for AJK).
- **MVP scope**: Core ride flow only (Auth → Onboarding → Book → Negotiate → Accept → Chat → PIN start → Track → Complete).
- **Languages**: English + Roman Urdu (Latin script). Translations authored by E1.
- **Design**: User-supplied brand guide — Deep Green (#16A34A), white/charcoal, card-based UI, large touch targets, map-first home, "Uber trust + inDrive flexibility + local Kashmir trust".

## Architecture
| Layer | Tech |
|---|---|
| Frontend | React 18 + Tailwind + Framer Motion + React Router 6 + React Leaflet + Axios + lucide-react |
| Backend | FastAPI + Motor (async MongoDB) + httpx |
| DB | MongoDB (collections: users, user_sessions, rides, chats, sos_alerts) |
| Auth | Emergent Google OAuth → server session_token (cookie + Bearer) |
| Maps | OpenStreetMap tiles via Leaflet |

## User Personas
1. **Rural Rider** (Hattian villager): low signal, prefers cash, negotiates fares.
2. **Local Driver** (Muzaffarabad-based): owns Suzuki Mehran, goes online when free, accepts/counters offers.

## Core Requirements (static)
- Map-first home, click-to-pin pickup/drop
- Fare negotiation: 90s timer, max 3 counters per side, mutual acceptance required
- Chat unlocks only after acceptance; phone only revealed post-acceptance
- 4-digit Ride PIN — driver enters PIN to start ride
- SOS alert + trip-share (WhatsApp / native share)
- Cash payment confirmed by driver on completion
- Multilingual UI (en + ur) with persistent preference
- Light + Dark theme with persistent preference

## What's been implemented (2026-05-16, Session 1) ✅
- Emergent Google OAuth with session_token (cookie + Bearer dual auth)
- Onboarding: role selection (rider/driver) + profile form (name, phone, village, city, vehicle/CNIC/license for drivers)
- Map-first Home: Leaflet map, click-to-pin pickup/drop, bottom-sheet fare offer
- Driver Home: Online/Offline toggle, polling ride requests (3s)
- Full ride lifecycle: create → counter (max 3/side, 90s expiry) → accept (cannot accept own offer) → PIN-verified start → complete → earnings credited
- In-app chat (gated post-acceptance), polls every 2.5s
- SOS button (records alert), Share trip (native + WhatsApp fallback), tel:-link calling
- Rides history, Profile (avatar, rating, earnings), Settings (theme, language, profile edit, logout)
- Roman Urdu translations (Latin script — natural, not broken Urdu)
- Light & Dark themes, persistent in localStorage + backend
- Background task auto-expires offers > 90s every 15s
- 100% backend test pass (20/20 pytest) + 100% frontend Playwright pass

## API Surface
- `POST /api/auth/session` · `GET /api/auth/me` · `POST /api/auth/logout`
- `PATCH /api/users/me`
- `POST /api/drivers/status`
- `POST /api/rides` · `GET /api/rides/{id}` · `GET /api/rides/me/history` · `GET /api/rides/driver/requests`
- `POST /api/rides/{id}/counter` · `/accept` · `/reject` · `/start` · `/complete` · `/sos`
- `GET /api/rides/{id}/chat` · `POST /api/rides/{id}/chat`
- `POST /api/rides/{id}/driver-location`

## Backlog (P0)
- Phone OTP (Twilio) signup as alternative to Google
- Live driver location streaming (websockets or 5s polling) during in_progress
- Push notifications (FCM) for new offers / counters / arrivals

## Backlog (P1)
- Multi-stop / ride scheduling
- Admin panel (driver approval, dispute resolution, demand heatmap)
- Driver verification workflow (CNIC + License upload + admin approve)
- Trip rating system (1–5 stars)
- Driver subscription / featured listing monetization

## Backlog (P2)
- Offline-first PWA with last-known-location cache
- Manual pin correction in low-signal mode
- Masked calling (Twilio Proxy)
- Regional demand heatmaps
- Trip share live tracking link (public read-only ride view)

## Smart Enhancement Suggestion
Add a **"Frequent Routes" auto-suggest** on the rider home — after 3 rides, suggest common pickup→drop pairs as one-tap shortcuts (e.g. "Home → Hattian Bazaar"). This dramatically reduces tap friction for repeat trips, a high-value win in rural village markets where the same routes are used daily.
