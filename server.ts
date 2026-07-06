import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  doc,
  deleteDoc
} from "firebase/firestore";

// Read from environment variables, or fallback to the user's explicit config
let firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY || "AIzaSyAlbFM0xgVZM9QyB4OdJ-jol2TiwqZuDPE",
  authDomain: process.env.FIREBASE_AUTH_DOMAIN || "papaonco-49365.firebaseapp.com",
  projectId: process.env.FIREBASE_PROJECT_ID || "papaonco-49365",
  storageBucket: process.env.FIREBASE_STORAGE_BUCKET || "papaonco-49365.firebasestorage.app",
  messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || "509410271140",
  appId: process.env.FIREBASE_APP_ID || "1:509410271140:web:60e8d82ce29493545beb31"
};

let databaseId: string | undefined = undefined;

const CONFIG_PATH = path.join(process.cwd(), "firebase-applet-config.json");
if (fs.existsSync(CONFIG_PATH)) {
  try {
    const fileConfig = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf8"));
    firebaseConfig = {
      apiKey: fileConfig.apiKey || firebaseConfig.apiKey,
      authDomain: fileConfig.authDomain || firebaseConfig.authDomain,
      projectId: fileConfig.projectId || firebaseConfig.projectId,
      storageBucket: fileConfig.storageBucket || firebaseConfig.storageBucket,
      messagingSenderId: fileConfig.messagingSenderId || firebaseConfig.messagingSenderId,
      appId: fileConfig.appId || firebaseConfig.appId,
    };
    if (fileConfig.firestoreDatabaseId) {
      databaseId = fileConfig.firestoreDatabaseId;
    }
    console.log("Loaded Firebase configuration from firebase-applet-config.json. databaseId:", databaseId);
  } catch (err) {
    console.error("Failed to read firebase-applet-config.json:", err);
  }
}

// Initialize Firebase App & Firestore
let db: any = null;
let isFirebaseAvailable = false;

try {
  const fbApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  db = databaseId ? getFirestore(fbApp, databaseId) : getFirestore(fbApp);
  isFirebaseAvailable = true;
  console.log(`Successfully connected to Firebase Firestore! (Project: ${firebaseConfig.projectId}, Database ID: ${databaseId || "default"})`);
} catch (error) {
  console.error("Firebase initialization failed. Falling back to local storage file:", error);
}

const LOCAL_DB_PATH = path.join(process.cwd(), "local_records.json");

// Local DB Helpers
function getLocalRecords() {
  if (fs.existsSync(LOCAL_DB_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(LOCAL_DB_PATH, "utf8"));
    } catch (e) {
      console.error("Failed to parse local records JSON:", e);
      return [];
    }
  }
  return [];
}

function saveLocalRecord(record: any) {
  try {
    const records = getLocalRecords();
    records.push(record);
    records.sort((a: any, b: any) => b.createdAtMs - a.createdAtMs);
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(records, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to save local record:", error);
  }
}

function deleteLocalRecord(id: string) {
  try {
    const records = getLocalRecords();
    const filtered = records.filter((r: any) => r.id !== id && String(r.createdAtMs) !== String(id));
    fs.writeFileSync(LOCAL_DB_PATH, JSON.stringify(filtered, null, 2), "utf8");
  } catch (error) {
    console.error("Failed to delete local record:", error);
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // GET ALL HEALTH RECORDS
  app.get("/api/records", async (req, res) => {
    if (isFirebaseAvailable && db) {
      try {
        const recordsCollection = collection(db, "records");
        const q = query(recordsCollection, orderBy("createdAtMs", "desc"));
        const snapshot = await getDocs(q);
        const records: any[] = [];
        snapshot.forEach((docSnap) => {
          records.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        res.json(records);
        return;
      } catch (err: any) {
        console.warn("Firestore fetch failed, falling back to local file:", err.message);
      }
    }
    // Fallback
    res.json(getLocalRecords());
  });

  // CREATE NEW HEALTH RECORD
  app.post("/api/records", async (req, res) => {
    const record = req.body;
    if (isFirebaseAvailable && db) {
      try {
        const recordsCollection = collection(db, "records");
        const docRef = await addDoc(recordsCollection, record);
        res.status(201).json({ id: docRef.id, ...record });
        return;
      } catch (err: any) {
        console.warn("Firestore save failed, saving to local file fallback:", err.message);
      }
    }
    // Fallback
    const localId = String(record.createdAtMs || Date.now());
    const savedRecord = { id: localId, ...record };
    saveLocalRecord(savedRecord);
    res.status(201).json(savedRecord);
  });

  // DELETE HEALTH RECORD BY ID
  app.delete("/api/records/:id", async (req, res) => {
    const { id } = req.params;
    if (isFirebaseAvailable && db && id && !id.startsWith("local_")) {
      try {
        const docRef = doc(db, "records", id);
        await deleteDoc(docRef);
        res.json({ success: true, id });
        return;
      } catch (err: any) {
        console.warn("Firestore delete failed, deleting from local fallback:", err.message);
      }
    }
    // Fallback
    deleteLocalRecord(id);
    res.json({ success: true, id });
  });

  // Serve static files / Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
