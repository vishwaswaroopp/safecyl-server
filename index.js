// index.js
const express = require("express");
const cors = require("cors");
const admin = require("firebase-admin");

const app = express();
app.use(express.json());
app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://thriving-smakager-628315.netlify.app",
  ],
  methods: ["GET","POST","OPTIONS"],
}));

// ---- Firebase Admin init (3-env-var mode) ----
const projectId   = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey    = process.env.FIREBASE_PRIVATE_KEY || "";

// turn \n into real newlines (fixes "Invalid PEM" problem)
privateKey = privateKey.replace(/\\n/g, "\n");

admin.initializeApp({
  credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.database();

// ---- Health
app.get("/", (_req, res) => res.send("✅ SafeCyl Backend Running"));

// ---- Demo API used by your frontend
app.get("/api/ping", (_req, res) => res.json({ ok: true, time: Date.now() }));

app.get("/api/echo", (req, res) => {
  res.json({ value: req.query.value ?? "" });
});

app.post("/api/save", async (req, res) => {
  const value = req.body?.value ?? "";
  await db.ref("demo/value").set({ value, ts: Date.now() });
  res.json({ status: "saved", value });
});

// ---- Sensor endpoints (optional)
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
