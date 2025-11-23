// index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();

const app = express();
app.use(express.json());

// Custom CORS middleware to allow all origins
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

app.use(cors());

// ---- Firebase Admin init (supports 2 styles) ----
function initFirebase() {
  // 1) Single JSON in FIREBASE_SERVICE_ACCOUNT (recommended on Render)
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    const svc = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: svc.project_id,
        clientEmail: svc.client_email,
        // the JSON already contains \n; pass as-is
        privateKey: svc.private_key,
      }),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
    return;
  }

  // 2) Split vars (PROJECT_ID / CLIENT_EMAIL / PRIVATE_KEY)
  if (
    process.env.FIREBASE_PROJECT_ID &&
    process.env.FIREBASE_CLIENT_EMAIL &&
    process.env.FIREBASE_PRIVATE_KEY
  ) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        // convert \n escape sequences to real newlines
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
      }),
      databaseURL: process.env.FIREBASE_DB_URL,
    });
    return;
  }

  throw new Error("No Firebase credentials found.");
}

initFirebase();
const db = admin.database();

// ---- Health ----
app.get("/", (_req, res) => res.send("✅ SafeCyl Backend Running"));

// ---- Demo endpoints ----
app.get("/api/ping", (_req, res) => res.json({ ok: true, time: Date.now() }));

app.get("/api/echo", (req, res) => res.json({ value: req.query.value ?? "" }));

app.post("/api/save", async (req, res) => {
  const value = req.body?.value ?? "";
  await db.ref("demo/value").set({ value, ts: Date.now() });
  res.json({ status: "saved", value });
});

// ---- Read entire DB ----
app.get("/api/all", async (_req, res) => {
  try {
    const snap = await db.ref().once("value");
    const data = snap.val();
    res.json({ ok: true, data });
  } catch (err) {
    console.error("Error fetching all data:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
