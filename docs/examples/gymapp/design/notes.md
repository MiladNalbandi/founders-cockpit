# GymApp — Design Notes

A three-screen mockup of the MVP, aligned to `docs/PRD.md`. The thesis from the PRD is *"the fastest set-logging experience on the web, with built-in progressive overload math"* — every design choice below comes back to that.

## Screens included

1. **Home** — greeting, streak/PR stats, the day's prescribed workout, and program shelf. One-tap entry into the workout from the prominent ink-black hero card.
2. **Logger (primary task)** — the screen Sam will see most. Live timer, exercise progress dots, per-set rows showing previous performance, a *suggested next set* card from the progressive-overload engine, and a custom thumb-zone numpad with mode toggles (Weight / Reps / RPE). The active set row is outlined in ink so the user always knows where input lands.
3. **Summary (success state)** — celebration, volume vs. last session, top set, average RPE, PR list with badge type, e1RM trendline sparkline (Epley), and a preview of the next session.

## Visual system

- **Palette:** off-white paper (`#F6F6F2`), near-black ink (`#0B0F0A`), and a single lime accent (`#C6FF3D`). The lime is reserved for momentum — PRs, "start", "save", positive trends. Used sparingly so it actually means something.
- **Type:** Inter throughout, tightened tracking on display sizes (`-0.035em`) for a confident, sporty editorial feel without resorting to a "fitness" cliché font.
- **Geometry:** 2xl–3xl rounded corners, generous 16–20px gutters, thin inset rings (`inset 0 0 0 1px rgba(11,15,10,0.08)`) instead of heavy borders.
- **Device frame:** 380×780 PWA viewport with a notch — reinforces that MVP is web-mobile, per PRD §1.

## UX choices tied to the PRD

- **<5s set log (§3.1):** dedicated numpad always visible, Save key in accent for thumb reach, previous performance shown inline so the user rarely needs to consult history.
- **Progressive overload (§3.3):** suggestion is a peer of the set rows, not buried — it appears above the active row with the *why* ("last session +1 rep"). Goal: visible within 100ms, learnable in one workout.
- **History & PRs (§3.4):** summary screen surfaces the e1RM trendline directly so weekly desktop review (the secondary use case) feels natural; mobile gets the same chart shrunk to a sparkline.
- **Offline-first (§3.5):** the logger header shows an `Offline · queued` pill; the summary shows `Synced` with a green dot. The user is always told the truth about their data without it being alarming.
- **No social, no AI gimmick:** zero feed, comments, or chatbot UI — matches non-goals in §4.

## What's intentionally absent

- No tab for "Discover," "Friends," or "Coach AI".
- No promotional modals, paywall, or onboarding interstitials in these three screens.
- No skeuomorphic gym imagery — the product is a *tool*, not a lifestyle brand.
