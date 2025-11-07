// index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://thriving-smakager-628315.netlify.app"
  ],
  methods: ["GET","POST","OPTIONS"]
}));

// ---- Firebase Admin via ENV (no file) ----
const required = ["FIREBASE_PROJECT_ID","FIREBASE_CLIENT_EMAIL","FIREBASE_PRIVATE_KEY","FIREBASE_DB_URL"];
for (const k of required) {
  if (!process.env[k]) {
    console.error(`Missing ENV ${k}`);
    process.exit(1);
  }
}

const serviceAccount = {
  type: "service_account",
  project_id: process.env.FIREBASE_PROJECT_ID,
  client_email: process.env.FIREBASE_CLIENT_EMAIL,
  private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
};

try {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    databaseURL: process.env.FIREBASE_DB_URL,
  });
} catch (e) {
  console.error("Firebase init failed:", e.message);
  process.exit(1);
}

const db = admin.database();

// ---- Health
app.get("/", (_req, res) => res.send("✅ SafeCyl Backend Running"));

// ---- Sensor APIs
app.get("/sensor", async (_req, res) => {
  const snap = await db.ref("sensor").once("value");
  res.json(snap.val());
});
app.post("/sensor", async (req, res) => {
  await db.ref("sensor").update(req.body || {});
  res.json({ status: "updated" });
});

// ---- Frontend-demo APIs
app.get("/api/ping", (_req, res) => res.json({ ok:true, time: Date.now() }));
app.get("/api/echo", (req, res) => res.json({ value: req.query.value ?? "" }));
app.post("/api/save", async (req, res) => {
  const value = req.body?.value ?? "";
  await db.ref("demo/value").set({ value, ts: Date.now() });
  res.json({ status: "saved", value });
});

// ---- Start
const PORT = process.env.PORT || 10000; // Render autodetects
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
