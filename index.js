// index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();
const app = express();
app.use(express.json());

app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://thriving-smakager-628315.netlify.app",
    ],
    methods: ["GET", "POST"],
  })
);

// ---- Firebase: load from FILE directly (simple method) ----
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.database();

// ---- Health Check ----
app.get("/", (req, res) => {
  res.send("✅ SafeCyl Backend Running");
});

// ---- Sensor Node Endpoints ----
app.get("/sensor", async (req, res) => {
  const snap = await db.ref("sensor").once("value");
  res.json(snap.val());
});

app.post("/sensor", async (req, res) => {
  await db.ref("sensor").update(req.body || {});
  res.json({ status: "updated" });
});

// ---- Frontend Demo Endpoints ----
app.get("/api/ping", (req, res) => {
  res.json({ ok: true, time: Date.now() });
});

app.get("/api/echo", (req, res) => {
  res.json({ value: req.query.value || "" });
});

app.post("/api/save", async (req, res) => {
  const value = req.body.value || "";
  await db.ref("demo/value").set({ value, ts: Date.now() });
  res.json({ status: "saved", value });
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
