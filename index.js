// index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();

const app = express();
app.use(express.json());

// CORS: allow local dev + your Netlify site
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://thriving-smakager-628315.netlify.app",
    ],
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// ---- Firebase Admin init (ENV first, fallback file for local) ----
let cred;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    // IMPORTANT: FIREBASE_SERVICE_ACCOUNT must be valid JSON (private_key uses \n)
    cred = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else {
    // For local-only if you keep a file (DO NOT commit):
    cred = admin.credential.cert("./serviceAccount.json");
  }
} catch (e) {
  console.error("Firebase credential init failed:", e);
  process.exit(1);
}

admin.initializeApp({
  credential: cred,
  databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.database();

// ---- Health ----
app.get("/", (_req, res) => res.send("✅ SafeCyl Backend Running"));

// ---- Sensor demo (Realtime DB) ----
app.get("/sensor", async (_req, res) => {
  const snap = await db.ref("sensor").once("value");
  res.json(snap.val() ?? {});
});

app.post("/sensor", async (req, res) => {
  await db.ref("sensor").update(req.body || {});
  res.json({ status: "updated" });
});

// ---- Frontend-expected demo APIs ----
app.get("/api/ping", (_req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.get("/api/echo", (req, res) => {
  res.json({ value: req.query.value ?? "" });
});

app.post("/api/save", async (req, res) => {
  const value = req.body?.value ?? "";
  await db.ref("demo/value").set({ value, ts: Date.now() });
  res.json({ status: "saved", value });
});

// ---- Start ----
const PORT = process.env.PORT || 10000; // Render auto-detects this
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
