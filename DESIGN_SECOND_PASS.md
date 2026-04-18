# Stadium Console — Second-Pass Cleanup

The first pass rebuilt all **public, data-facing pages** (home, rankings, bracket, recaps, transactions, history, and per-league standings + matchups) on the new Stadium Console tokens. Those screens are verified in the preview server and render cleanly with zero console errors.

Everything listed below is **knowingly deferred**. The pages work at runtime — they just still render with the old Tailwind-3-era palette (`bg-bg-tertiary`, `glass-card`, `accent-gold`, ambulance-amber banners, etc.) instead of the new `--ink-*` / `--surface-*` / `--accent-*` tokens and the Bebas/Geist/Fraunces type stack.

---

## 1. Admin surfaces (biggest chunk)

None of these have been touched. They still look like the pre-design-system admin.

**Routes:**

- [src/app/admin/page.tsx](src/app/admin/page.tsx) — Commissioner Command Center dashboard
- [src/app/admin/situation-room/page.tsx](src/app/admin/situation-room/page.tsx) — Draft monitoring hub (22 old-token hits — the worst offender)
- [src/app/admin/season/page.tsx](src/app/admin/season/page.tsx)
- [src/app/admin/season-setup/page.tsx](src/app/admin/season-setup/page.tsx) — 6-step wizard shell
- [src/app/admin/season-setup/steps/Step1StartSeason.tsx](src/app/admin/season-setup/steps/Step1StartSeason.tsx)
- [src/app/admin/season-setup/steps/Step2Cohorts.tsx](src/app/admin/season-setup/steps/Step2Cohorts.tsx)
- [src/app/admin/season-setup/steps/Step3Registrations.tsx](src/app/admin/season-setup/steps/Step3Registrations.tsx)
- [src/app/admin/season-setup/steps/Step4ConfigureAndAssign.tsx](src/app/admin/season-setup/steps/Step4ConfigureAndAssign.tsx)
- [src/app/admin/season-setup/steps/Step5DraftOrder.tsx](src/app/admin/season-setup/steps/Step5DraftOrder.tsx)
- [src/app/admin/season-setup/steps/Step6SleeperLinking.tsx](src/app/admin/season-setup/steps/Step6SleeperLinking.tsx)
- [src/app/admin/draft/page.tsx](src/app/admin/draft/page.tsx)
- [src/app/admin/members/page.tsx](src/app/admin/members/page.tsx)
- [src/app/admin/members/[id]/page.tsx](src/app/admin/members/[id]/page.tsx)
- [src/app/admin/bracket/page.tsx](src/app/admin/bracket/page.tsx)
- [src/app/admin/archive/page.tsx](src/app/admin/archive/page.tsx)

**Shared admin components:**

- [src/components/admin/CohortDetailPanel.tsx](src/components/admin/CohortDetailPanel.tsx) — expandable registration list
- [src/components/admin/ConfirmModal.tsx](src/components/admin/ConfirmModal.tsx)
- [src/components/admin/InviteEmailGenerator.tsx](src/components/admin/InviteEmailGenerator.tsx)

**What the design bundle implies for admin:** the uploaded pack did not include an admin-dashboard screen, but the token set should carry — think `surface-raised` panels, `crumb-bar` navigation, `phase-pill` for season status, `kicker` labels, and Bebas display headlines on Command Center cards. The Situation Room specifically wants the `.livedot` + `.chip--live` treatment on active drafts to match the public `/bracket` live-state language.

---

## 2. Public flows not covered by the bundle

These are live user-facing pages that got skipped because they weren't in the hero screens.

- [src/app/draft/[boardId]/page.tsx](src/app/draft/[boardId]/page.tsx) — live draft board (Realtime-subscribed). High-visibility page during draft weekend.
- [src/app/register/[token]/page.tsx](src/app/register/[token]/page.tsx) — public cohort registration form. First impression for new members.
- [src/app/identify/page.tsx](src/app/identify/page.tsx) — email lookup. Small page, quick win.
- [src/app/team/me/page.tsx](src/app/team/me/page.tsx) — personal dashboard.
- [src/app/trophies/page.tsx](src/app/trophies/page.tsx) — awards page.

**Recommendation for the draft board:** reuse the Situation Room visual language (circular progress, on-the-clock chip, recent-picks list) once that's built — they should share primitives.

---

## 3. Loading skeletons + error boundaries + 404

Every route-segment skeleton still uses `bg-bg-tertiary` / `glass-card` / `animate-pulse`. They need to be swapped to Stadium Console equivalents (a `skeleton` helper in `globals.css` that uses `--surface-2` with the new shimmer would do it in one place).

- [src/app/loading.tsx](src/app/loading.tsx)
- [src/app/bracket/loading.tsx](src/app/bracket/loading.tsx)
- [src/app/rankings/loading.tsx](src/app/rankings/loading.tsx)
- [src/app/recaps/loading.tsx](src/app/recaps/loading.tsx)
- [src/app/transactions/loading.tsx](src/app/transactions/loading.tsx)
- [src/app/history/loading.tsx](src/app/history/loading.tsx)
- [src/app/leagues/[leagueId]/loading.tsx](src/app/leagues/[leagueId]/loading.tsx)
- [src/app/leagues/[leagueId]/matchups/loading.tsx](src/app/leagues/[leagueId]/matchups/loading.tsx)
- [src/app/team/me/loading.tsx](src/app/team/me/loading.tsx)
- [src/app/error.tsx](src/app/error.tsx)
- [src/app/bracket/error.tsx](src/app/bracket/error.tsx)
- [src/app/rankings/error.tsx](src/app/rankings/error.tsx)
- [src/app/leagues/[leagueId]/error.tsx](src/app/leagues/[leagueId]/error.tsx)
- [src/app/not-found.tsx](src/app/not-found.tsx) — "That's what she said" page; wants the editorial Fraunces treatment.

---

## 4. Component leftovers

- [src/components/ui/OffSeasonBanner.tsx](src/components/ui/OffSeasonBanner.tsx) — still `amber-500/10` tailwind. Visible on the home page when off-season (screenshot in verification confirms it renders, but in the wrong palette). Swap to a chip built with `--accent-clock` (yellow in Stadium Console) or a dedicated `.banner--offseason` primitive.
- **Dead code to delete:**
  - [src/components/ui/Card.tsx](src/components/ui/Card.tsx) — zero imports after the rebuild.
  - [src/components/ui/KickerLabel.tsx](src/components/ui/KickerLabel.tsx) — zero imports after the rebuild.

Both were replaced by raw `.surface-raised` / `.kicker` CSS classes in `globals.css`. Safe to remove alongside the second pass.

---

## 5. Email recap template

The design bundle covered the **on-site** recap reader (`/recaps`) but did not include an email template. The Resend integration (`RESEND_API_KEY`) is configured and the newsletter table exists, so when recaps start sending out, the HTML email needs its own adaptation of the editorial style (Fraunces body, Bebas display, HR Compliance "Toby" callout required per CLAUDE.md legal requirement).

This is out-of-scope for the design pass as-delivered, but worth flagging so it doesn't get missed when email sending goes live.

---

## 6. Bugs found during verification (not design-related but noted)

**Tailwind 4 breakpoint regression — double nav below `md`.** At viewport widths under 768 px, both `nav.topnav__links.hidden.md:flex` and `nav.md:hidden` resolve to `display: flex` simultaneously, rendering two nav bars stacked. The `hidden md:flex` combo from Tailwind 3 is not being honored by Tailwind 4's utility layer the same way.

- Reproducible at viewport width 747 px.
- Fix candidates: (a) rewrite the header using the `@media` `--breakpoint-md` CSS variable directly, (b) move the nav-switching logic to a single container with `@container` queries, or (c) add explicit `hidden` overrides in `globals.css` that Tailwind 4 cannot strip.
- Affects: [src/components/layout/Nav.tsx](src/components/layout/Nav.tsx) primarily.

**React Compiler warnings.** 11 call-sites flagged by `eslint-plugin-react-hooks@7` — already documented in CLAUDE.md. These are warnings, not errors; fix pass required **before** enabling the React Compiler. Known spots: `useRef(Date.now())` initializers, synchronous `setState` inside `useEffect`, and `resetTimer` referenced before declaration in [src/app/draft/[boardId]/page.tsx](src/app/draft/[boardId]/page.tsx).

---

## Estimated scope

- Admin surfaces: **~2 days** (15+ files, but mostly mechanical token swaps once a shared `admin.css` pattern block is written).
- Public flows (draft / register / identify / team / trophies): **~1 day**.
- Loading + error + 404: **~2–3 hours** if a shared `.skeleton` primitive is added first.
- Component leftovers + dead-code deletion: **~30 min**.
- Email template: **separate project** — tied to Resend activation.
- Tailwind 4 nav regression: **~1 hour** once root cause is confirmed.

Total: roughly a 3-day second pass to reach full parity.
