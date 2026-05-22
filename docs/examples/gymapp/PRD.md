# GymApp — Product Requirements Document

**Owner:** Product Strategy
**Date:** 2026-05-15
**Status:** v0.1 (MVP scope locked)
**Platform (MVP):** Web (responsive, mobile-first PWA)

---

## 1. Problem Statement

**Who:** Intermediate gym-goers (1–5 years lifting) running structured strength/hypertrophy programs 3–5x/week.

**What:** They track workouts in Notes, spreadsheets, or bloated apps (Hevy, Strong, Fitbod) that bury set entry under social feeds, ads, and AI gimmicks, and don't surface progression at the moment of decision.

**Why now:**
- Social-fitness fatigue — lifters want a fast logger, not a feed.
- PWAs + offline IndexedDB make a web-first tracker viable without app-store gatekeeping.
- Cheap LLM inference makes autoregulation (RPE-based load suggestions) trivial to deliver.

**Wedge:** the fastest set-logging experience on the web, with progressive-overload math built in.

---

## 2. Target User & Primary Use Case

**Primary persona:** "Sam," 28, 4x/week hypertrophy split, logs between sets on whatever phone is nearest.

**Primary use case:** Mid-workout, phone browser, opens GymApp → taps next exercise → logs weight × reps × RPE in <5 seconds → sees prescribed load for the next set auto-calculated from last session.

**Secondary:** Weekly desktop review — volume, PRs, e1RM trendlines per lift.

---

## 3. MVP Scope (must-have)

1. **Fast set logger** — Log weight/reps/RPE for an exercise in ≤2 taps + numeric input.
   *Acceptance:* P95 time-to-log a set <5s on mobile web from app open.

2. **Program templates + routine builder** — Seeded templates (PPL, Upper/Lower, 5/3/1 BBB) plus custom routine builder.
   *Acceptance:* User starts a templated workout in ≤3 taps from home; custom routines persist across devices.

3. **Progressive overload engine** — Per-lift next-session load suggestion from last performance + RPE.
   *Acceptance:* Every logged exercise shows a prescribed load for next session within 100ms of completion.

4. **History & PR tracking** — Per-exercise last-5 sessions, e1RM (Epley) trendline, PR badges (1RM/3RM/5RM/volume).
   *Acceptance:* Tapping any exercise opens history + trendline chart in <300ms (cached).

5. **Offline-first sync** — Full workout flow works offline; syncs on reconnect with last-write-wins per set.
   *Acceptance:* Airplane-mode workout surfaces in cloud within 10s of reconnect; sync failure rate <0.5%.

---

## 4. Non-Goals (deliberately NOT building)

- Native iOS/Android apps (PWA only for MVP; Capacitor wrap in Phase 2).
- Social feed, friends, comments, likes.
- Cardio, running, cycling.
- Nutrition / macro tracking.
- Wearable integrations (Apple Watch, Garmin, Whoop).
- AI form-check, video analysis, coaching chatbot.
- Gym check-ins, class booking, gym-owner SaaS.
- Payments / paywall (free during MVP; monetization is Phase 2).

---

## 5. Success Metrics

**Quantitative (North Star):** Weekly Logged Workouts per Active User ≥ **3.0** by week 8 post-launch.

**Qualitative:** Of 10 user interviews at week 6, ≥7 unprompted users describe GymApp as *"faster"* or *"cleaner"* than their previous tracker.

**Supporting KPIs:** D7 retention ≥35%, P95 set-log latency <5s, sync-failure rate <0.5%.

---

## 6. Tech Stack

**Web (MVP):**
- **Framework:** Next.js 15 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind + shadcn/ui
- **State:** Zustand (client), TanStack Query (server cache)
- **Offline:** IndexedDB via Dexie; service worker via Serwist
- **Charts:** Recharts
- **Auth:** Clerk (email + Apple/Google OAuth + Passkeys)
- **API:** tRPC on Next.js route handlers
- **DB:** Postgres (Neon) + Drizzle ORM
- **Sync:** Last-write-wins per set, client timestamps, write queue in IndexedDB
- **Hosting:** Vercel
- **Observability:** PostHog (product) + Sentry (errors)

**iOS / Android (Phase 2, ~month 4):**
- Wrap the PWA in **Capacitor** for store presence + HealthKit / Health Connect bridges.
- If native perf becomes the bottleneck, migrate to **React Native (Expo)** sharing the tRPC API and pure logic modules.

---

## 7. Two-Week Build Plan

**Week 1 — Core loop**

- **Day 1 (Mon):** Repo init (Next.js + TS + Tailwind + shadcn). Vercel + Neon + Clerk wired. GitHub Actions CI.
- **Day 2 (Tue):** Drizzle schema (users, exercises, routines, workouts, sets). Seed ~150-lift exercise library.
- **Day 3 (Wed):** Auth + onboarding (units kg/lb, experience). Home skeleton.
- **Day 4 (Thu):** Workout logger UI — exercise list, set rows, thumb-optimized weight/reps/RPE inputs.
- **Day 5 (Fri):** tRPC mutations + Postgres persistence. Basic history view.
- **Day 6 (Sat):** Routine builder + 3 seeded templates (PPL, Upper/Lower, 5/3/1 BBB).
- **Day 7 (Sun):** Buffer + dogfood Workout #1.

**Week 2 — Differentiators + ship**

- **Day 8 (Mon):** Progressive-overload engine (RPE load calc + double-progression fallback) surfaced in logger.
- **Day 9 (Tue):** PR detection, badges, Epley e1RM trendline (Recharts).
- **Day 10 (Wed):** Offline mode — Dexie, service worker, write queue, reconnect sync.
- **Day 11 (Thu):** PWA install prompt, icon/splash, mobile polish, haptics where supported.
- **Day 12 (Fri):** Internal alpha (5 lifters). PostHog funnels (open → first set → finish workout).
- **Day 13 (Sat):** Triage. Fix top 5 issues. Performance pass against set-log latency budget.
- **Day 14 (Sun):** Closed beta — 50-user waitlist via Twitter / r/weightroom. Ship v0.1.

---

## Open Questions (resolved, recorded for traceability)

- Units default? **Prompt once, remember.**
- RPE vs. RIR as primary input? **RPE; RIR in tooltip.**
- Phase-2 monetization? **Subscription ($4.99/mo) gated on advanced programming + cloud history >90 days.**
