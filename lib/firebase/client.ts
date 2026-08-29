import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import { connectFunctionsEmulator, getFunctions, type Functions } from "firebase/functions";
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
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_AUTH_EMULATOR_HOST;
  if (emulator && /^[A-Za-z0-9.-]+:\d{2,5}$/.test(emulator)) {
    connectAuthEmulator(cachedAuth, `http://${emulator}`, { disableWarnings: true });
  }
  return cachedAuth;
}

export function getFirebaseFunctions(): Functions {
  if (cachedFunctions) return cachedFunctions;
  cachedFunctions = getFunctions(getFirebaseApp());
  const emulator = process.env.NEXT_PUBLIC_FIREBASE_FUNCTIONS_EMULATOR_HOST;
  if (emulator) {
    const [host, portText] = emulator.split(":");
    const port = Number(portText);
    if (host && Number.isInteger(port) && port > 0 && port <= 65535) {
      connectFunctionsEmulator(cachedFunctions, host, port);
    }
  }
  return cachedFunctions;
}
