// Frontend Firebase client (Auth + Firestore). No Admin credentials here.

import { getApp, getApps, initializeApp } from "firebase/app";
import type { FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth } from "firebase/auth";
import type { Auth } from "firebase/auth";
import { connectFirestoreEmulator, getFirestore } from "firebase/firestore";
import type { Firestore } from "firebase/firestore";

export type FirebaseClients = {
  app: FirebaseApp;
  auth: Auth;
  db: Firestore;
  configured: true;
};

export type FirebaseMissing = { configured: false; reason: string };

function readConfig() {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string | undefined,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string | undefined,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string | undefined,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string | undefined,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string | undefined,
    appId: import.meta.env.VITE_FIREBASE_APP_ID as string | undefined,
  };
}

export function firebaseReady(): boolean {
  const c = readConfig();
  return Boolean(c.apiKey && c.authDomain && c.projectId && c.appId);
}

export function getFirebase(): FirebaseClients | FirebaseMissing {
  if (!firebaseReady()) {
    return {
      configured: false,
      reason:
        "Firebase web config missing. Copy values into frontend/.env.local (see docs/FIREBASE_SETUP.md).",
    };
  }
  const config = readConfig();
  const app = getApps().length ? getApp() : initializeApp(config);
  const auth = getAuth(app);
  const db = getFirestore(app);

  if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
    try {
      connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
      connectFirestoreEmulator(db, "127.0.0.1", 8080);
    } catch {
      /* already connected */
    }
  }

  return { app, auth, db, configured: true };
}
