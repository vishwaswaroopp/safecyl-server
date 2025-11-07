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
  methods: ["GET","POST","OPTIONS"],
}));

// ---- Firebase Admin init: ENV first, file fallback (local only) ----
let cred;
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    cred = admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT));
  } else {
    cred = admin.credential.cert("./serviceAccount.json"); // only for local dev if file exists
  }
} catch (e) {
  console.error("Firebase credential init failed:", e.message);
  process.exit(1);
}
admin.initializeApp({
  credential: cred,
  databaseURL: process.env.FIREBASE_DB_URL,
});
const db = admin.database();

// ---- Health & demo routes your frontend calls ----
app.get("/", (_req, res) => res.send("✅ SafeCyl Backend Running"));
app.get("/api/ping", (_req, res) => res.json({ ok: true, time: Date.now() }));
app.get("/api/echo", (req, res) => res.json({ value: req.query.value ?? "" }));
app.post("/api/save", async (req, res) => {
  const value = req.body?.value ?? "";
  await db.ref("demo/value").set({ value, ts: Date.now() });
  res.json({ status: "saved", value });
});

// ---- Your sensor endpoints ----
app.get("/sensor", async (_req, res) => {
  const snap = await db.ref("sensor").once("value");
  res.json(snap.val());
});
app.post("/sensor", async (req, res) => {
  await db.ref("sensor").update(req.body || {});
  res.json({ status: "updated" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
