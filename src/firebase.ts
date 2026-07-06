/// <reference types="vite/client" />
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

// Read from environment variables, fallback to the default PapaOnco Firebase project
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAlbFM0xgVZM9QyB4OdJ-jol2TiwqZuDPE",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "papaonco-49365.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "papaonco-49365",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "papaonco-49365.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "509410271140",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:509410271140:web:60e8d82ce29493545beb31",
};

export const getFirebaseApp = () => {
  try {
    return getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  } catch (err) {
    console.error("Firebase App initialization failed:", err);
    return null;
  }
};

export const db = (() => {
  const app = getFirebaseApp();
  if (!app) return null;
  try {
    return getFirestore(app);
  } catch (err) {
    console.error("Firestore initialization failed:", err);
    return null;
  }
})();
