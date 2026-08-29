function requireEnv(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `Missing required env var ${name}. Copy .env.local.example to .env.local and fill in your Firebase project config.`,
    );
  }
  return value;
}

/**
 * Built lazily (only when actually called) rather than as a module-level
 * constant. A module-level `requireEnv(...)` call throws the instant this
 * file is imported — including during Next.js's build-time prerendering of
 * *unrelated* static pages (e.g. /_not-found), which import the root
 * layout, which mounts AuthProvider, which reaches this module, with no
 * Firebase usage involved at all. Deferring the check to call time means a
 * missing env var only ever surfaces where Firebase is actually used, at
 * runtime in the browser.
 */
export function getFirebaseConfig() {
  return {
    apiKey: requireEnv("NEXT_PUBLIC_FIREBASE_API_KEY", process.env.NEXT_PUBLIC_FIREBASE_API_KEY),
    authDomain: requireEnv("NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN", process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN),
    projectId: requireEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    appId: requireEnv("NEXT_PUBLIC_FIREBASE_APP_ID", process.env.NEXT_PUBLIC_FIREBASE_APP_ID),
  };
}
