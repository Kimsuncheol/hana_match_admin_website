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

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
