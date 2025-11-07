// index.js
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://thriving-smakager-628315.netlify.app",
  ],
  methods: ["GET", "POST", "OPTIONS"],
  credentials: false,
}));

// ---------- Firebase Admin (from single JSON env) ----------
const svcJson = process.env.FIREBASE_SERVICE_ACCOUNT;
if (!svcJson) {
  console.error("Missing FIREBASE_SERVICE_ACCOUNT env");
  process.exit(1);
}
let serviceAccount;
try {
  serviceAccount = JSON.parse(svcJson);
  // In case the private key has \n escapes:
  if (serviceAccount.private_key)
    serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, "\n");
} catch (e) {
  console.error("Bad FIREBASE_SERVICE_ACCOUNT JSON:", e.message);
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL,
});
const db = admin.database();

// ---------- Health ----------
app.get("/", (_req, res) => res.send("✅ SafeCyl Backend Running"));

// ---------- Demo + sensor APIs ----------
app.get("/api/ping", (_req, res) => res.json({ ok: true, time: Date.now() }));
app.get("/api/echo", (req, res) => res.json({ value: req.query.value ?? "" }));
app.post("/api/save", async (req, res) => {
  const value = req.body?.value ?? "";
  await db.ref("demo/value").set({ value, ts: Date.now() });
  res.json({ status: "saved", value });
});

app.get("/sensor", async (_req, res) => {
  const snap = await db.ref("sensor").once("value");
  res.json(snap.val());
});
app.post("/sensor", async (req, res) => {
  await db.ref("sensor").update(req.body || {});
  res.json({ status: "updated" });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
