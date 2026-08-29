import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFunctions, type Functions } from "firebase/functions";
import { getFirebaseConfig } from "./config";

let cachedApp: FirebaseApp | undefined;
let cachedAuth: Auth | undefined;
let cachedFunctions: Functions | undefined;

function getFirebaseApp(): FirebaseApp {
  if (cachedApp) return cachedApp;
  cachedApp = getApps().length ? getApp() : initializeApp(getFirebaseConfig());
  return cachedApp;
}

/** Lazily initialized — see the comment on getFirebaseConfig for why. */
export function getFirebaseAuth(): Auth {
  if (cachedAuth) return cachedAuth;
  cachedAuth = getAuth(getFirebaseApp());
  return cachedAuth;
}

export function getFirebaseFunctions(): Functions {
  if (cachedFunctions) return cachedFunctions;
  cachedFunctions = getFunctions(getFirebaseApp());
  return cachedFunctions;
}
