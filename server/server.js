require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");
const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json({ limit: "2mb" }));

// ---- uploads folder (emergency videos) ----
const UP = path.join(__dirname, "uploads");
fs.mkdirSync(UP, { recursive: true });
app.use("/uploads", express.static(UP));

// ---- MongoDB ----
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB connected"))
  .catch(err => console.log("MongoDB error:", err.message));

const Case = mongoose.model("Case", new mongoose.Schema({
  cid: { type: String, required: true, unique: true },
  type: String, personId: String, name: String, age: Number,
  desc: String, place: String, time: String, status: String,
  lat: Number, lng: Number, acc: Number,   // emergency location
  phone: String,                            // family ka number (kabhi API se wapas nahi jata)
  photo: String,                            // chhota thumbnail (data URL)
  video: String                             // uploads/ me file ka naam
}, { timestamps: true }));

// ---- Routes ----
app.get("/api/health", async (req, res) => {
  const total = await Case.countDocuments().catch(() => -1);
  res.json({
    status: "ok",
    db: mongoose.connection.readyState === 1 ? "connected" : "not connected",
    cases: total
  });
});

app.get("/api/cases", async (req, res) => {
  try {
    const list = await Case.find().sort({ createdAt: -1 }).limit(150).lean();   // phone jaan-boojh ke nahi bhejte
    res.json(list.map(c => ({
      id: c.cid, type: c.type, personId: c.personId, name: c.name, age: c.age,
      desc: c.desc, place: c.place, time: c.time, status: c.status,
      lat: c.lat, lng: c.lng, acc: c.acc, photo: c.photo, video: c.video
    })));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

function num(v) {
  if (v === null || v === undefined || v === "") return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

app.post("/api/cases", async (req, res) => {
  const b = req.body;
  if (!b || typeof b.id !== "string" || !b.id) {
    return res.status(400).json({ error: "id missing" });
  }
  const data = {
    type: String(b.type || ""), personId: String(b.personId || ""),
    name: String(b.name || ""), age: Number(b.age) || 0,
    desc: String(b.desc || ""), place: String(b.place || ""),
    time: String(b.time || ""), status: String(b.status || "open")
  };
  const la = num(b.lat), ln = num(b.lng), ac = num(b.acc);
  if (la !== undefined && ln !== undefined && Math.abs(la) <= 90 && Math.abs(ln) <= 180) {
    data.lat = la; data.lng = ln;
    if (ac !== undefined) data.acc = ac;
  }
  if (typeof b.photo === "string" && b.photo.startsWith("data:image/") && b.photo.length <= 200000) {
    data.photo = b.photo;
  }
  if (typeof b.phone === "string") {
    const ph = b.phone.replace(/[^0-9+]/g, "").slice(0, 15);
    if (ph) data.phone = ph;
  }
  if (typeof b.video === "string") {
    data.video = b.video.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 80);
  }
  try {
    // upsert: naya ho to banao, pehle se ho to update (duplicate nahi banega)
    await Case.updateOne({ cid: b.id }, { $set: data }, { upsert: true });
    res.json({ saved: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ---- Video upload (bina extra package ke, seedha file me) ----
app.post("/api/media/:id", express.raw({ type: "*/*", limit: "40mb" }), (req, res) => {
  const id = String(req.params.id).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 60);
  const ext = (String(req.query.ext || "mp4").replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4").toLowerCase();
  if (!id || !Buffer.isBuffer(req.body) || !req.body.length) {
    return res.status(400).json({ error: "empty upload" });
  }
  const file = id + "." + ext;
  fs.writeFile(path.join(UP, file), req.body, err => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ saved: true, file: file });
  });
});

// ---- Live location (patient + emergency team), memory me ----
const live = {};   // caseId -> { patient:{lat,lng,t}, team:{lat,lng,t} }

app.post("/api/live", (req, res) => {
  const b = req.body || {};
  const id = String(b.caseId || "").slice(0, 60);
  const kind = b.kind === "team" ? "team" : "patient";
  const lat = num(b.lat), lng = num(b.lng);
  if (!id || lat === undefined || lng === undefined || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return res.status(400).json({ error: "caseId/lat/lng galat hai" });
  }
  live[id] = live[id] || {};
  live[id][kind] = { lat: lat, lng: lng, t: Date.now() };

  // purane entries hata do (memory na bhare)
  const keys = Object.keys(live);
  if (keys.length > 300) {
    keys.sort((a, c) => {
      const ta = Math.max((live[a].patient || {}).t || 0, (live[a].team || {}).t || 0);
      const tc = Math.max((live[c].patient || {}).t || 0, (live[c].team || {}).t || 0);
      return ta - tc;
    }).slice(0, keys.length - 300).forEach(k => delete live[k]);
  }
  res.json({ ok: true });
});

app.get("/api/live", (req, res) => {
  res.json(live[String(req.query.caseId || "")] || {});
});

app.listen(3000, () => console.log("Rakshak server: http://localhost:3000"));