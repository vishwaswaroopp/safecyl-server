const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const admin = require("firebase-admin");

dotenv.config();

admin.initializeApp({
  credential: admin.credential.cert({
    project_id: process.env.FIREBASE_PROJECT_ID,
    client_email: process.env.FIREBASE_CLIENT_EMAIL,
    private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
  databaseURL: process.env.FIREBASE_DB_URL,
});

const db = admin.database();
const app = express();

app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("✅ SafeCyl Backend Running");
});

app.get("/sensor", async (req, res) => {
  const snap = await db.ref("sensor").once("value");
  res.json(snap.val());
});

app.post("/sensor", async (req, res) => {
  await db.ref("sensor").update(req.body);
  res.json({ status: "updated" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ Backend → http://localhost:${PORT}`));
