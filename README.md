This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Admin authentication

Wired to the `hana-match` Firebase project. Copy `.env.local.example` to
`.env.local` and fill in the client config plus a service account (Project
settings > Service accounts > Generate new private key).

- Sign-up/sign-in/reset screens: `app/(auth)/`
- Role assignment on sign-up (server-verified, never client-set):
  `app/api/admin/assign-role/route.ts` → `lib/firebase-admin/assign-role.ts`
- Route gating + forced claims refresh: `components/auth/protected-route.tsx`
- Optional domain allowlist: `ADMIN_ALLOWED_EMAIL_DOMAINS` env var

`functions/` holds an alternate implementation of the same role-assignment
logic as an Identity Platform blocking function, which is more robust
(claims are set before the account ever exists) but requires the project on
the Blaze plan with Identity Platform enabled. Not currently deployed;
switch to it later by following `functions/src/index.ts`.

`firestore.rules` in the repo root is a **reference, not deployed** —
hana-match's Firestore already serves the existing app under its own rules.
See the comment at the top of that file before deploying it.

## Admin dashboard

`/dashboard` (`app/dashboard/`). Server-authorized: the client never
decides what data it's allowed to see — `app/api/admin/dashboard/route.ts`
re-derives the caller's role from their verified ID token
(`lib/firebase-admin/authorize.ts`) and shapes the response accordingly. A
moderator's request never even triggers a read of the AI latency
collection, not just a client-side hidden field.

- **Metrics/queue/model-health aggregation** (pure, unit-tested):
  `lib/dashboard/metrics.ts`, composed per-role in `lib/dashboard/build-payload.ts`
- **Data model**: `moderationCases` and `aiLatencyLogs` Firestore collections,
  documented as types in `lib/dashboard/types.ts`. This schema is new — the
  app/AI pipeline doesn't write to it yet, so the dashboard will show its
  empty state until that ingestion is built. Composite index for the cases
  query lives in `firestore.indexes.json` (deployed).
- **No raw evidence**: `CaseRecord` (the raw Firestore shape) may carry an
  `evidenceRef` pointer; `buildPriorityQueue` in `metrics.ts` allowlists
  the exact fields that reach the client, so evidence can't leak even if
  the schema grows more evidence-adjacent fields later. Covered by a
  regression test in `metrics.test.ts` and `build-payload.test.ts`.
- **Roles**: `admin` (full dashboard) and `moderator` (open cases + hidden
  content only, no SLA breach counts, no AI latency/model health). Both
  carry the `admin: true` custom claim; `role` distinguishes them
  (`lib/firebase/claims.ts` client-side, `lib/firebase-admin/authorize.ts`
  server-side — an unrecognized/missing role string is treated as
  moderator, never admin). There's no self-serve or admin-console path to
  grant `moderator` yet; it's set via the Admin SDK out of band.
- **Nav**: `components/nav/admin-nav.tsx` renders links per role and
  collapses to a menu button on narrow viewports.
- **Loading/error states**: `app/dashboard/dashboard-content.tsx` — skeleton
  while loading, a distinct message for expired session (401) vs.
  insufficient role (403) vs. network failure (retryable) in
  `components/dashboard/error-state.tsx`.
- **Unauthorized-access tests**: `lib/firebase-admin/authorize.test.ts`
  (token/role matrix), `app/api/admin/dashboard/route.test.ts` (401/403 at
  the route), `components/auth/protected-route.test.tsx` and
  `app/dashboard/dashboard-content.test.tsx` (client-side denial + 403
  handling).

## Moderation case detail and actions

`/moderation/cases/[caseId]` reads an allowlisted, server-masked detail DTO
from `GET /api/admin/moderation/cases/[caseId]`. Raw evidence references and
unmasked evidence never enter the browser response. AI labels, confidence,
rules, and suggestions are displayed as review context only.

All case decisions and user-impacting actions are submitted to the callable
Cloud Function `moderateCase` in `functions/src/index.ts`. The function:

- verifies the Firebase `admin` claim and `admin`/`moderator` role;
- requires the case to be assigned to the caller and enforces an optimistic
  `version` check;
- accepts only a fixed action enum, reason, and (for corrections) label;
- derives the transition server-side and atomically writes an immutable
  `auditLogs` record with before/after state and a generated `correlationId`;
- applies warnings and Talk rate limits to `userModerationStates`; and
- turns permanent suspension into a `humanReviewRequests` item requiring two
  approvals. It never directly sets a permanent-suspension state.

The collection blocks in `firestore.rules` deny all browser writes to
`moderationCases`, `auditLogs`, `humanReviewRequests`, `moderationEffects`, and
`userModerationStates`. That file is still a reference: merge these blocks
into the live hana-match ruleset before deployment. Deploy the callable with
`firebase deploy --only functions:moderateCase` after configuring the Firebase
project. This avoids deploying the optional Identity Platform blocking
function unless that feature is enabled intentionally.

## User operations

`/users` provides exact email/UID search, Firebase verification and account
status, trust/restriction flags, recent moderation history, and last activity.
The protected `GET /api/admin/users` endpoint masks email, display name, and
UID for display. Full admins receive limited case/reason context from audit
history; moderators receive action/date summaries only and a read-only UI.

All account mutations call the `administerUser` callable Cloud Function. It
requires the full `admin` role, rejects arbitrary state fields, prevents
self-disable, validates optimistic versions and reasons, and writes an
`auditLogs` record with before/after state and a generated correlation ID.
Deploy both moderation callables with
`firebase deploy --only functions:moderateCase,functions:administerUser`.

## Super-admin policy settings

`/settings/policy` is gated to the exact `admin: true`, `role: "superAdmin"`
custom-claim combination. The UI never reads Firestore directly. The
`getPolicySettings` callable returns the current allowlisted configuration and
limited version metadata; `mutatePolicySettings` is the only write path.

Every publish and rollback:

- validates the complete runtime shape and cross-field invariants again in the
  Cloud Function;
- requires a 10–500 character reason and an optimistic `expectedVersion`;
- creates a new immutable `policyVersions` document instead of modifying an
  existing version;
- creates an immutable `auditLogs` document with actor, reason, before/after,
  correlation ID, and rollback provenance; and
- returns the new version ID plus its server-derived `rollbackTargetId`.

A rollback copies a validated prior version into a new head, preserving both
the prior history and a path to undo the rollback. Browser reads and writes to
`policySettings` and `policyVersions` are denied by the reference
`firestore.rules`; merge and deploy those rules deliberately with the live
application rules.

For local testing, copy the two non-secret entries from
`firebase-emulator.env.example` into `.env.local`, then run:

```bash
firebase emulators:start --only auth,firestore,functions
```

The browser clients connect to Auth and Functions emulators only when those
explicit environment variables are present. Seed an emulator user with
`{ admin: true, role: "superAdmin" }` claims, and deploy/test the callables with
`npm --prefix functions test` and `npm --prefix functions run build`. The pure
contract tests cover denied roles, unsupported client fields, validation,
and rollback inputs without requiring production credentials.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
