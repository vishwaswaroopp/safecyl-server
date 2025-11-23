// index.js
const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");
const mongoose = require("mongoose");

dotenv.config();

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || "mongodb+srv://vishwa:hydenpesgoat@cluster0.b143miw.mongodb.net/safecyl?retryWrites=true&w=majority";

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Connection Error:', err));

// MongoDB Schema for sensor data - only loadcel and mq
const SensorDataSchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  loadcel: { type: Number, required: true },
  mq: { type: Number, required: true }
}, { timestamps: true });

const SensorData = mongoose.model('SensorData', SensorDataSchema);

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

// ---- Read entire DB and store in MongoDB ----
app.get("/api/all", async (_req, res) => {
  try {
    // Get current data from Firebase
    const snap = await db.ref().once("value");
    const firebaseData = snap.val();
    
    if (firebaseData) {
      // Extract and parse sensor values - only loadcel and mq
      const sensorReading = {
        loadcel: parseFloat(firebaseData.loadcel) || 0,
        mq: parseFloat(firebaseData["mq-2"] || firebaseData.mq) || 0,
        timestamp: new Date() // Ensure unique timestamp for each entry
      };
      
      // Store in MongoDB - create new document every time
      try {
        const savedData = await SensorData.create(sensorReading);
        console.log('✅ Data stored in MongoDB:', {
          id: savedData._id,
          loadcel: savedData.loadcel,
          mq: savedData.mq,
          timestamp: savedData.timestamp
        });
      } catch (mongoErr) {
        console.error('❌ MongoDB storage error:', mongoErr);
      }
    }
    
    // Get total count of historical records
    const totalRecords = await SensorData.countDocuments();
    
    // Return current data and record count
    res.json({ 
      ok: true, 
      data: firebaseData,
      current: {
        loadcel: parseFloat(firebaseData.loadcel) || 0,
        mq: parseFloat(firebaseData["mq-2"] || firebaseData.mq) || 0
      },
      totalRecords: totalRecords
    });
    
  } catch (err) {
    console.error("Error fetching all data:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ---- Get all historical data for graph display ----
app.get("/api/history", async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const skip = parseInt(req.query.skip) || 0;
    
    // Get historical data sorted by timestamp (newest first)
    const historicalData = await SensorData.find({})
      .sort({ timestamp: -1 })
      .limit(limit)
      .skip(skip)
      .select('loadcel mq timestamp createdAt');
    
    res.json({
      ok: true,
      data: historicalData.reverse(), // Reverse to show oldest first for graph
      totalRecords: await SensorData.countDocuments()
    });
    
  } catch (err) {
    console.error("Error fetching historical data:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ---- Analytics endpoints ----
app.get("/api/analytics/hourly", async (req, res) => {
  try {
    const hours = parseInt(req.query.hours) || 24;
    const startTime = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    const data = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: {
            hour: { $hour: "$timestamp" },
            day: { $dayOfYear: "$timestamp" },
            year: { $year: "$timestamp" }
          },
          avgLoadcel: { $avg: "$loadcel" },
          avgMq: { $avg: "$mq" },
          avgLpg: { $avg: "$lpg" },
          maxMq: { $max: "$mq" },
          minLoadcel: { $min: "$loadcel" },
          count: { $sum: 1 },
          timestamp: { $first: "$timestamp" }
        }
      },
      { $sort: { "_id.year": 1, "_id.day": 1, "_id.hour": 1 } }
    ]);
    
    res.json({ ok: true, data, hours });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

app.get("/api/analytics/daily", async (req, res) => {
  try {
    const days = parseInt(req.query.days) || 7;
    const startTime = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    const data = await SensorData.aggregate([
      { $match: { timestamp: { $gte: startTime } } },
      {
        $group: {
          _id: {
            day: { $dayOfYear: "$timestamp" },
            year: { $year: "$timestamp" }
          },
          avgLoadcel: { $avg: "$loadcel" },
          avgMq: { $avg: "$mq" },
          avgLpg: { $avg: "$lpg" },
          maxMq: { $max: "$mq" },
          minLoadcel: { $min: "$loadcel" },
          count: { $sum: 1 },
          date: { $first: { $dateToString: { format: "%Y-%m-%d", date: "$timestamp" } } }
        }
      },
      { $sort: { "_id.year": 1, "_id.day": 1 } }
    ]);
    
    res.json({ ok: true, data, days });
  } catch (err) {
    console.error("Daily analytics error:", err);
    res.status(500).json({ ok: false, error: String(err) });
  }
});

// ---- Start ----
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
