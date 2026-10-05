"use client";
import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";

// These values are public by design (Firebase web config); security comes from
// Firebase Auth + Firestore rules + server-side token verification.
const config = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

export const firebaseConfigured = Boolean(config.apiKey && config.projectId && config.authDomain);

let app: FirebaseApp | undefined;
function firebaseApp(): FirebaseApp {
  if (!firebaseConfigured) throw new Error("Firebase is not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.");
  app ??= getApps().length ? getApp() : initializeApp(config);
  return app;
}

export const clientAuth = (): Auth => getAuth(firebaseApp());
export const clientDb = (): Firestore => getFirestore(firebaseApp());
