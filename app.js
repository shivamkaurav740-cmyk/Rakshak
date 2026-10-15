

// ---------- 1. DATA ----------
function load(key) {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch (e) { return []; }
}
function put(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch (e) { alert("Browser ki storage bhar gayi. Purane records ya photos hata dijiye."); return false; }
}

let people = load("people");
let cases  = load("cases");
let sms    = load("sms");
let online = localStorage.getItem("online") === null
  ? navigator.onLine
  : localStorage.getItem("online") === "true";

const $ = (id) => document.getElementById(id);

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, c =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function saveData()  { put("people", people); }
function saveCases() { put("cases", cases); }
function saveSMS()   { put("sms", sms); }
function newId()     { return "RK-" + Math.floor(1000 + Math.random() * 9000); }
function nowTime()   { return new Date().toLocaleTimeString(); }

// Purane cases (jo galti se "synced" mark ho gaye the) ek baar dobara bhejne ke liye
if (localStorage.getItem("syncv") !== "2") {
  cases.forEach(c => { c.synced = false; });
  localStorage.setItem("syncv", "2");
  saveCases();
}

// ---------- 2. SERVER (status + address) ----------
const BASES = ["http://localhost:3000", "http://127.0.0.1:3000"];
let apiBase = BASES[0];
let lastErr = "";

async function pingServer() {
  lastErr = "";
  for (const b of BASES) {
    try {
      const r = await fetch(b + "/api/health", { cache: "no-store" });
      if (!r.ok) { lastErr = "HTTP " + r.status; continue; }
      const j = await r.json();
      apiBase = b;
      paintServer(j);
      return j;
    } catch (e) {
      lastErr = e.message;
    }
  }
  paintServer(null);
  return null;
}

function paintServer(j) {
  const el = $("srv");
  let text, col;
  if (!j) {
    text = "Server: not reachable"; col = "#c62828";
    el.title = "Error: " + lastErr + " | Check karo: server terminal me 'node server.js' chal raha hai?";
  } else if (j.db === "connected") {
    text = "Server + MongoDB: connected"; col = "#2e9e4f";
    el.title = "Cases on server: " + j.cases;
  } else if (j.db) {
    text = "Server OK, MongoDB NOT connected"; col = "#e0a100";
    el.title = ".env ki MONGO_URI ya password check karo";
  } else {
    text = "Old server (no MongoDB)"; col = "#e0a100";
    el.title = "Purana server chal raha hai. taskkill /F /IM node.exe karke node server.js chalao";
  }
  el.textContent = text;
  el.style.cssText = "font-size:12px;padding:3px 8px;border-radius:10px;cursor:pointer;color:#fff;background:" + col;
}

$("srv").addEventListener("click", async () => {
  const j = await pingServer();
  alert(j
    ? "Server OK. DB: " + (j.db || "old server") + " | cases on server: " + j.cases
    : "Server nahi mila. Error: " + lastErr);
  if (j && online) syncAll();
});

// ---------- 3. TABS ----------
const buttons = document.querySelectorAll("nav button");
const tabs = document.querySelectorAll(".tab");

buttons.forEach(btn => {
  btn.addEventListener("click", () => {
    buttons.forEach(b => b.classList.remove("active"));
    tabs.forEach(t => t.classList.remove("active"));
    btn.classList.add("active");
    $(btn.dataset.tab).classList.add("active");
  });
});

// ---------- 4. REGISTER + QR (photo ke saath) ----------
// Photo ko chhota (120px) karte hain, warna localStorage jaldi bhar jata hai
function shrinkPhoto(file, cb, maxPx) {
  const img = new Image();
  const url = URL.createObjectURL(file);
  img.onload = () => {
    const k = Math.min(1, (maxPx || 120) / Math.max(img.width, img.height));
    const c = document.createElement("canvas");
    c.width = Math.max(1, Math.round(img.width * k));
    c.height = Math.max(1, Math.round(img.height * k));
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    URL.revokeObjectURL(url);
    cb(c.toDataURL("image/jpeg", 0.6));
  };
  img.onerror = () => { URL.revokeObjectURL(url); cb(""); };
  img.src = url;
}

$("photo").addEventListener("change", () => {
  const f = $("photo").files && $("photo").files[0];
  if (!f) { $("photoPreview").innerHTML = ""; return; }
  shrinkPhoto(f, (data) => {
    $("photoPreview").innerHTML = data
      ? '<img src="' + esc(data) + '" style="width:60px;height:60px;object-fit:cover;border-radius:6px;border:1px solid #ccc;">'
      : "";
  });
});

$("saveBtn").addEventListener("click", () => {
  const name = $("name").value.trim();
  const phone = $("phone").value.trim();
  if (!name || !phone) { alert("Name and phone are required"); return; }

  const finish = (photoData) => {
    const person = {
      id: newId(),
      name: name,
      age: Number($("age").value) || 0,
      phone: phone,
      desc: $("desc").value.trim(),
      photo: photoData || ""
    };
    people.push(person);
    saveData();
    renderList();
    fillPeople();
    showWristband(person);

    ["name", "age", "phone", "desc"].forEach(id => $(id).value = "");
    $("photo").value = "";
    $("photoPreview").innerHTML = "";
  };

  const f = $("photo").files && $("photo").files[0];
  if (f) shrinkPhoto(f, finish); else finish("");
});

function renderList() {
  const box = $("list");
  if (people.length === 0) { box.textContent = "No one registered yet."; return; }
  box.innerHTML = people.map(p => `
    <div class="person" style="display:flex; gap:10px; align-items:center; margin-bottom:10px;">
      ${p.photo ? `<img src="${esc(p.photo)}" style="width:50px;height:50px;object-fit:cover;border-radius:6px;border:1px solid #ccc;">` : ""}
      <div>
        <b>${esc(p.name)}</b> (${esc(p.age)} yrs)<br>
        <small>${esc(p.id)} · ${esc(p.phone)} · ${esc(p.desc)}</small><br>
        <button data-qr="${esc(p.id)}">Show QR</button>
      </div>
    </div>
  `).join("");
}

function showWristband(person) {
  $("wristband").style.display = "block";
  $("wbInfo").textContent = person.name + " · " + person.age + " yrs · ID: " + person.id;

  const qrBox = $("qr");
  qrBox.innerHTML = "";
  // QR ke andar: RK|id|name|age|phone  (offline bhi padha ja sakta hai)
  const text = ["RK", person.id, person.name, person.age, person.phone].join("|");
  if (window.QRCode) {
    new QRCode(qrBox, { text: text, width: 170, height: 170 });
  } else {
    qrBox.textContent = "QR library load nahi hui (pehli baar internet chahiye)";
  }
}

$("list").addEventListener("click", (e) => {
  const id = e.target.dataset.qr;
  if (!id) return;
  const person = people.find(p => p.id === id);
  if (person) showWristband(person);
});

function fillPeople() {
  $("missingPerson").innerHTML =
    people.map(p => `<option value="${esc(p.id)}">${esc(p.name)} (${esc(p.id)})</option>`).join("");
}

// ---------- 5. ONLINE / OFFLINE + SYNC ----------
function paintNet() {
  const btn = $("net");
  btn.textContent = online ? "● ONLINE" : "● OFFLINE";
  btn.classList.toggle("off", !online);
}

async function setNetwork(state) {
  online = state;
  localStorage.setItem("online", online);
  paintNet();
  renderCases();
  if (online) {
    const n = await syncAll();
    if (n > 0) alert(n + " record(s) synced to server");
  }
}

$("net").addEventListener("click", () => setNetwork(!online));
window.addEventListener("offline", () => setNetwork(false));
window.addEventListener("online",  () => setNetwork(true));

let syncing = false;

async function syncAll() {
  if (syncing) return 0;
  syncing = true;
  let count = 0;
  let failed = false;

  try {
    const j = await pingServer();                       // server mil raha hai?
    if (!j) throw new Error(lastErr || "server not reachable");
    if (j.db === "not connected") throw new Error("server chal raha hai par MongoDB connected nahi");

    for (const c of cases.filter(c => !c.synced)) {
      try {
        if (c.hasVideo && !c.video) await uploadVideo(c);   // pehle video, fir case
      } catch (err) {
        failed = true;
        console.log("Video upload nahi hua:", err.message);
        continue;                                          // case unsynced rahega, baad me retry
      }
      const copy = Object.assign({}, c);                   // local-only fields server ko nahi jate
      delete copy.synced;
      delete copy.hasVideo;
      const res = await fetch(apiBase + "/api/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(copy)
      });
      if (res.ok) {
        c.synced = true; count++;
        if (c.hasVideo) idbDel(c.id).catch(() => {});
      } else { failed = true; console.log("Server rejected case:", res.status); }
    }

    // Server tak pahunch gaye, tabhi queued SMS "sent" karo
    if (!failed) {
      sms.forEach(s => { if (s.state === "queued") { s.state = "sent"; count++; } });
    }
  } catch (err) {
    console.log("Sync nahi hua:", err.message);
  } finally {
    syncing = false;
  }

  saveCases();
  saveSMS();
  renderCases();
  renderSMS();
  return count;
}

// Server baad me chalu ho to bhi pending records apne aap chale jayein
setInterval(() => {
  if (!online) return;
  if (cases.some(c => !c.synced)) syncAll().then(pullAlerts);
  else pullAlerts();
}, 15000);

// ---------- 6. REPORT MISSING / RECORD FOUND ----------
$("missingBtn").addEventListener("click", () => {
  const person = people.find(p => p.id === $("missingPerson").value);
  if (!person) { alert("Register a person first"); return; }

  const c = {
    id: "C" + Date.now(),
    type: "missing",
    personId: person.id,
    name: person.name,
    age: person.age,
    desc: person.desc,
    place: $("place").value,
    time: nowTime(),
    photo: person.photo || "",     // volunteer ko pehchanne me madad
    phone: person.phone,           // server me jata hai, par API se wapas nahi aata
    synced: false,
    status: "open"
  };
  cases.unshift(c);
  saveCases();
  renderCases();
  findMatches(c);
  if (online) syncAll();
});

$("foundBtn").addEventListener("click", () => {
  const name = $("fname").value.trim();
  const desc = $("fdesc").value.trim();
  if (!name && !desc) { alert("Naam ya description daalo"); return; }

  const c = {
    id: "C" + Date.now(),
    type: "found",
    name: name || "Unknown",
    age: Number($("fage").value) || 0,
    desc: desc,
    place: $("fplace").value,
    time: nowTime(),
    synced: false,
    status: "open"
  };
  cases.unshift(c);
  saveCases();
  renderCases();
  findMatches(c);
  if (online) syncAll();
  ["fname", "fage", "fdesc"].forEach(id => $(id).value = "");
});

function caseHTML(c) {
  return `
    <div class="case">
      <b>${esc(c.name)}</b> — ${esc((c.type || "").toUpperCase())}
      <span class="tag ${c.status === "matched" ? "matched" : ""}">${esc((c.status || "open").toUpperCase())}</span><br>
      <small>${esc(c.desc && c.type === "medical" ? c.desc + " · " : "")}${esc(c.place)} · ${esc(c.time)} · ${c.synced ? "☁ synced" : "📱 offline, not synced"}</small>
    </div>`;
}

function renderCases() {
  const pending = cases.filter(c => !c.synced).length
                + sms.filter(s => s.state === "queued").length;
  $("pending").textContent = "Pending: " + pending;

  const people_cases = cases.filter(c => c.type !== "medical");
  $("cases").innerHTML = people_cases.length ? people_cases.map(caseHTML).join("") : "No cases yet.";

  const miss = cases.filter(c => c.type === "missing" && c.status === "open");
  $("missingList").innerHTML = miss.length
    ? miss.map(missingHTML).join("")
    : "Abhi koi open missing report nahi hai.";

  const med = cases.filter(c => c.type === "medical");
  $("medList").innerHTML = med.length ? med.map(medicalHTML).join("") : "No emergency alerts yet.";
}

function missingHTML(c) {
  return `
    <div class="case" style="display:flex; gap:10px; align-items:flex-start;">
      ${c.photo ? `<img src="${esc(c.photo)}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #ccc;">` : ""}
      <div style="flex:1;">
        <b>${esc(c.name)}</b> (${esc(c.age)} yrs)
        <span class="tag">MISSING</span><br>
        <small>${esc(c.desc)}</small><br>
        <small>last seen: ${esc(c.place)} · ${esc(c.time)}</small><br>
        <button data-seen="${esc(c.id)}" style="margin-top:6px; padding:4px 10px; cursor:pointer;">✅ Ye mil gaya</button>
      </div>
    </div>`;
}

// "Ye mil gaya" dabane par found form me details bhar do
$("missingList").addEventListener("click", (e) => {
  const id = e.target.dataset.seen;
  if (!id) return;
  const c = cases.find(x => x.id === id);
  if (!c) return;
  $("fname").value = c.name;
  $("fage").value = c.age || "";
  $("fdesc").value = c.desc || "";
  $("matches").innerHTML = "<div class='match'>Form bhar diya. <b>Found at</b> check karke <b>Record found</b> dabao, fir match confirm karo.</div>";
  $("fname").scrollIntoView({ behavior: "smooth", block: "center" });
});

$("pullMissing").addEventListener("click", async () => {
  if (!online) { alert("Pehle ONLINE karo."); return; }
  const j = await pingServer();
  if (!j) { alert("Server nahi mila: " + lastErr); return; }
  const n = await pullAlerts();
  alert(n ? n + " naya/update report aaya" : "Koi naya report nahi.");
});

// ---------- 7. HINDI VOICE ----------
function startVoice(targetId, btn) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) { alert("Is browser me voice support nahi hai. Chrome use karo ya type karo."); return; }

  const rec = new SR();
  rec.lang = "hi-IN";
  rec.interimResults = false;
  btn.textContent = "🎙️";

  rec.onresult = (e) => { $(targetId).value = e.results[0][0].transcript; };
  rec.onerror  = (e) => alert("Voice error: " + e.error);
  rec.onend    = () => { btn.textContent = "🎤"; };
  rec.start();
}

document.querySelectorAll(".mic").forEach(btn => {
  btn.addEventListener("click", () => startVoice(btn.dataset.target, btn));
});

// ---------- 8. MATCHING ----------
const SYN = {
  "लाल":"red", "नीला":"blue", "पीला":"yellow", "हरा":"green", "सफेद":"white", "सफ़ेद":"white", "काला":"black",
  "कुर्ता":"kurta", "कुर्ती":"kurta", "साड़ी":"saree", "टोपी":"cap",
  "चश्मा":"glasses", "चश्मे":"glasses",
  "लड़का":"boy", "बच्चा":"boy", "लड़की":"girl", "बच्ची":"girl",
  "बुजुर्ग":"elderly", "दादी":"elderly", "दादा":"elderly"
};
const STOP = ["the", "and", "with", "है", "में", "और", "का", "की"];

function tokens(text) {
  const words = (text || "").toLowerCase().match(/[\p{L}\p{M}]+/gu) || [];
  return words.map(w => SYN[w] || w).filter(w => w.length > 2 && !STOP.includes(w));
}

function matchScore(a, b) {
  let score = 0;
  const aWords = tokens((a.desc || "") + " " + (a.name || ""));
  const bWords = tokens((b.desc || "") + " " + (b.name || ""));

  bWords.forEach(w => { if (aWords.includes(w)) score += 2; });
  if (a.age && b.age && Math.abs(a.age - b.age) <= 2) score += 2;
  if (a.name && a.name !== "Unknown" && b.name &&
      a.name.toLowerCase() === b.name.toLowerCase()) score += 6;

  return Math.min(100, score * 14);
}

function findMatches(newCase) {
  const opposite = newCase.type === "found" ? "missing" : "found";
  const list = cases
    .filter(c => c.type === opposite && c.status === "open")
    .map(c => ({ c: c, s: matchScore(newCase, c) }))
    .filter(x => x.s >= 20)
    .sort((a, b) => b.s - a.s);

  const box = $("matches");
  if (list.length === 0) {
    box.innerHTML = "<div class='match'>Abhi koi match nahi mila. Record save ho gaya.</div>";
    return;
  }
  box.innerHTML = list.map(x => `
    <div class="match">
      <b>${esc(x.c.name)}</b> (${esc(x.c.age)} yrs) — <b>${x.s}% match</b><br>
      <small>${esc(x.c.desc)} · ${esc(x.c.type)} at ${esc(x.c.place)}</small><br>
      <button data-a="${esc(newCase.id)}" data-b="${esc(x.c.id)}">Confirm &amp; alert family</button>
    </div>
  `).join("");
}

function matchPair(a, b) {
  const missing = a.type === "missing" ? a : b;
  const found   = a.type === "found"   ? a : b;

  missing.status = "matched";
  found.status = "matched";
  missing.synced = false;     // naya status server ko bhi jaye
  found.synced = false;

  const person = people.find(p => p.id === missing.personId);
  const to = (person && person.phone) || missing.phone || found.phone || "family (registered number)";
  sendSMS(to, missing.name + " is safe at " + found.place + ". Please come to the nearest help desk.");

  saveCases();
  renderCases();
  if (online) syncAll();
}

$("matches").addEventListener("click", (e) => {
  // Wristband se mila number: bina missing report ke bhi family ko batao
  const fam = e.target.dataset.fam;
  if (fam) {
    const f = cases.find(c => c.id === fam);
    if (!f) return;
    sendSMS(f.phone || "family", f.name + " mil gaya hai (" + f.place + "). Kripya nazdiki help desk par aayein.");
    f.status = "alerted";
    f.synced = false;
    saveCases();
    renderCases();
    $("matches").innerHTML = "<div class='match'>✅ Wristband ke number par alert bheja gaya.</div>";
    if (online) syncAll();
    return;
  }

  const aId = e.target.dataset.a;
  const bId = e.target.dataset.b;
  if (!aId || !bId) return;
  const a = cases.find(c => c.id === aId);
  const b = cases.find(c => c.id === bId);
  if (!a || !b) return;

  matchPair(a, b);
  $("matches").innerHTML = "<div class='match'>✅ Matched. Family ko alert bhej diya. Person ko nazdiki help desk par le jayein.</div>";
});

// --- QR wristband padhna ---
function byQR(txt) {
  const p = String(txt || "").trim().split("|");
  if (p[0] !== "RK" || p.length < 5) { alert("Ye Rakshak ka QR nahi lagta."); return; }
  const per = { id: p[1], name: p[2], age: Number(p[3]) || 0, phone: p[4] };

  const c = {
    id: "C" + Date.now(),
    type: "found",
    personId: per.id,
    name: per.name,
    age: per.age,
    desc: "",
    phone: per.phone,
    place: $("fplace").value,
    time: nowTime(),
    synced: false,
    status: "open"
  };
  cases.unshift(c);
  saveCases();

  const open = cases.find(x => x.type === "missing" && x.personId === per.id && x.status === "open");
  if (open) {
    matchPair(open, c);
    $("matches").innerHTML = "<div class='match'>✅ QR se pehchaan hui: <b>" + esc(per.name) +
      "</b> ki missing report mili. Family ko alert bhej diya. Person ko help desk par le jayein.</div>";
  } else {
    findMatches(c);
    $("matches").insertAdjacentHTML("beforeend",
      "<div class='match'>Is wristband par family ka number hai (••••" + esc(String(per.phone).slice(-4)) + "). " +
      "Abhi koi missing report nahi mili.<br><button data-fam=\"" + esc(c.id) + "\">Family ko alert bhejo</button></div>");
    renderCases();
    if (online) syncAll();
  }
}

$("qrRead").addEventListener("click", () => { byQR($("qrText").value); $("qrText").value = ""; });

let scanStream = null;
async function startScan() {
  if (!window.jsQR) { alert("QR reader load nahi hua (pehli baar internet chahiye). QR ka text paste karo."); return; }
  const v = $("scanVid");
  try {
    scanStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
    v.srcObject = scanStream;
    v.style.display = "block";
    await v.play();
    const cv = document.createElement("canvas");
    const tick = () => {
      if (!scanStream) return;
      if (v.videoWidth) {
        cv.width = v.videoWidth; cv.height = v.videoHeight;
        const cx = cv.getContext("2d");
        cx.drawImage(v, 0, 0);
        const d = cx.getImageData(0, 0, cv.width, cv.height);
        const r = jsQR(d.data, d.width, d.height);
        if (r && r.data) { stopScan(); byQR(r.data); return; }
      }
      requestAnimationFrame(tick);
    };
    tick();
  } catch (err) {
    alert("Camera nahi mila: " + err.message + ". QR ka text paste karo.");
  }
}
function stopScan() {
  if (scanStream) { scanStream.getTracks().forEach(t => t.stop()); scanStream = null; }
  $("scanVid").style.display = "none";
}
$("scanBtn").addEventListener("click", startScan);
$("scanStop").addEventListener("click", stopScan);

// ---------- 9. SMS (simulated) ----------
function sendSMS(to, msg) {
  sms.unshift({ to: to, msg: msg, state: online ? "sent" : "queued", time: nowTime() });
  saveSMS();
  renderSMS();
}

function renderSMS() {
  const box = $("smsLog");
  if (sms.length === 0) { box.textContent = "No SMS yet."; return; }
  box.innerHTML = sms.map(s => `
    <div class="case">To ${esc(s.to)} <span class="tag ${esc(s.state)}">${esc(s.state.toUpperCase())}</span><br>
    <small>${esc(s.msg)}</small></div>
  `).join("");
}

// ---------- 10. EMERGENCY (photo, video, GPS, live tracking) ----------

// --- video ko device me rakhne ke liye IndexedDB (localStorage me video nahi aata) ---
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open("rakshak-media", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("v", { keyPath: "id" });
    r.onsuccess = () => res(r.result);
    r.onerror = () => rej(r.error);
  });
}
async function idbPut(id, blob) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction("v", "readwrite");
    t.objectStore("v").put({ id: id, blob: blob });
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function idbGet(id) {
  const db = await idb();
  return new Promise((res, rej) => {
    const q = db.transaction("v").objectStore("v").get(id);
    q.onsuccess = () => res(q.result ? q.result.blob : null);
    q.onerror = () => rej(q.error);
  });
}
async function idbDel(id) {
  const db = await idb();
  return new Promise((res, rej) => {
    const t = db.transaction("v", "readwrite");
    t.objectStore("v").delete(id);
    t.oncomplete = () => res();
    t.onerror = () => rej(t.error);
  });
}
async function uploadVideo(c) {
  const blob = await idbGet(c.id);
  if (!blob) { c.hasVideo = false; return; }
  const ext = ((blob.type || "video/mp4").split("/")[1] || "mp4").split(";")[0].replace(/[^a-z0-9]/gi, "").slice(0, 5) || "mp4";
  const r = await fetch(apiBase + "/api/media/" + encodeURIComponent(c.id) + "?ext=" + ext, {
    method: "POST",
    headers: { "Content-Type": blob.type || "application/octet-stream" },
    body: blob
  });
  if (!r.ok) throw new Error("video upload failed " + r.status);
  const j = await r.json();
  c.video = j.file;
}

// --- GPS ---
let curLoc = null;      // form ke liye abhi ki location {lat,lng,acc}

function getLocation(ms) {
  return new Promise((res, rej) => {
    if (!navigator.geolocation) return rej(new Error("Is device me GPS support nahi hai"));
    navigator.geolocation.getCurrentPosition(
      p => res({ lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) }),
      e => rej(new Error(e.code === 1 ? "Location permission band hai (browser me Allow karo)" : (e.message || "Location nahi mili"))),
      { enableHighAccuracy: true, timeout: ms || 10000, maximumAge: 5000 }
    );
  });
}

function osmLink(la, ln) {
  la = Number(la); ln = Number(ln);
  return "https://www.openstreetmap.org/?mlat=" + la + "&mlon=" + ln + "#map=17/" + la + "/" + ln;
}
function hasPos(o) {
  return o && o.lat != null && o.lng != null && isFinite(o.lat) && isFinite(o.lng);
}

$("locBtn").addEventListener("click", async () => {
  const info = $("locInfo");
  info.style.color = "#555";
  info.textContent = "📡 Location dhundh rahe hain…";
  try {
    curLoc = await getLocation(12000);
    if (!$("healthLocation").value.trim()) {
      $("healthLocation").value = "GPS " + curLoc.lat.toFixed(5) + ", " + curLoc.lng.toFixed(5);
    }
    info.style.color = "green";
    info.innerHTML = "📍 " + curLoc.lat.toFixed(5) + ", " + curLoc.lng.toFixed(5) + " (±" + curLoc.acc + " m) · " +
      '<a href="' + osmLink(curLoc.lat, curLoc.lng) + '" target="_blank" rel="noopener">map me dekho</a>';
  } catch (err) {
    curLoc = null;
    info.style.color = "#c62828";
    info.textContent = "⚠ " + err.message + ". Location type karke bhi daal sakte hain.";
  }
});

$("emVideo").addEventListener("change", () => {
  const f = $("emVideo").files && $("emVideo").files[0];
  if (f && f.size > 30 * 1024 * 1024) {
    alert("Video 30 MB se badi hai. Chhoti video lein.");
    $("emVideo").value = "";
  }
  const p = $("emPhoto").files && $("emPhoto").files[0];
  const v = $("emVideo").files && $("emVideo").files[0];
  $("emMedia").textContent = (p ? "🖼 photo ready  " : "") + (v ? "🎥 video ready (" + (v.size / 1048576).toFixed(1) + " MB)" : "");
});
$("emPhoto").addEventListener("change", () => $("emVideo").dispatchEvent(new Event("change")));

function photoThumb(file) {
  return new Promise(res => { if (!file) return res(""); shrinkPhoto(file, res, 320); });
}

$("healthForm").addEventListener("submit", async function (e) {
  e.preventDefault();
  const form = e.target;
  const box = $("healthStatus");
  box.style.color = "#ea580c";
  box.textContent = "⏳ Alert bana rahe hain…";

  if (!curLoc) { try { curLoc = await getLocation(6000); } catch (err) { curLoc = null; } }

  const pf = $("emPhoto").files && $("emPhoto").files[0];
  const vf = $("emVideo").files && $("emVideo").files[0];

  const c = {
    id: "C" + Date.now(),
    type: "medical",
    name: $("patientName").value.trim(),
    age: 0,
    desc: $("emergencyType").value,
    place: $("healthLocation").value.trim(),
    time: nowTime(),
    synced: false,
    status: "open"
  };
  if (curLoc) { c.lat = curLoc.lat; c.lng = curLoc.lng; c.acc = curLoc.acc; }
  c.photo = await photoThumb(pf);
  if (vf) {
    try { await idbPut(c.id, vf); c.hasVideo = true; }
    catch (err) { alert("The video failed to save to the device: " + err.message); }
  }

  cases.unshift(c);
  saveCases();
  renderCases();
  form.reset();
  curLoc = null;
  $("locInfo").textContent = "";
  $("emMedia").textContent = "";

  if (!online) {
    box.style.color = "#ea580c";
    box.textContent = "📱The alert has been saved to the device. (OFFLINE).Pending network to upload to server.";
  } else {
    box.textContent = "⏳ Sending to server...";
    await syncAll();
    if (c.synced) { box.style.color = "green"; box.textContent = "✅ Alert sent to server successfully. (" + c.desc + ", " + c.place + ")."; }
    else { box.style.color = "#ea580c"; box.textContent = "⚠ Alert saved locally. Server not found. Retrying automatically..."; }
  }
  openTrack(c.id);
  startShare(c.id, "patient");
});

function medicalHTML(c) {
  const links = [];
  if (hasPos(c)) links.push('<a href="' + osmLink(c.lat, c.lng) + '" target="_blank" rel="noopener">📍 map</a>');
  if (c.video) links.push('<a href="' + esc(apiBase + "/uploads/" + c.video) + '" target="_blank" rel="noopener">🎥 video</a>');
  else if (c.hasVideo) links.push("🎥 video (upload baaki)");
  return `
    <div class="case" style="display:flex; gap:10px; align-items:flex-start;">
      ${c.photo ? `<img src="${esc(c.photo)}" style="width:64px;height:64px;object-fit:cover;border-radius:6px;border:1px solid #ccc;">` : ""}
      <div style="flex:1;">
        <b>${esc(c.name)}</b> — ${esc(c.desc)}
        <span class="tag ${c.status === "matched" ? "matched" : ""}">${esc((c.status || "open").toUpperCase())}</span><br>
        <small>${esc(c.place)} · ${esc(c.time)} · ${c.synced ? "☁ synced" : "📱 offline, not synced"}</small>
        ${links.length ? "<br><small>" + links.join(" · ") + "</small>" : ""}
        <div style="margin-top:6px; display:flex; gap:6px; flex-wrap:wrap;">
          <button data-act="track" data-id="${esc(c.id)}" style="padding:4px 10px; cursor:pointer;">🗺 Track</button>
          <button data-act="respond" data-id="${esc(c.id)}" style="padding:4px 10px; cursor:pointer;">🚑 I am responding.</button>
        </div>
      </div>
    </div>`;
}

// --- server se doosre device ke alerts lao (responder ke phone ke liye) ---
async function pullAlerts() {
  if (!online) return 0;
  try {
    const r = await fetch(apiBase + "/api/cases", { cache: "no-store" });
    if (!r.ok) return 0;
    const list = await r.json();
    let n = 0;
    list.forEach(s => {
      const mine = cases.find(c => c.id === s.id);
      if (!mine) { cases.push(Object.assign({}, s, { synced: true })); n++; }
      else if (mine.synced && s.status && s.status !== mine.status) { mine.status = s.status; n++; }
    });
    if (n) { saveCases(); renderCases(); }
    return n;
  } catch (e) { return 0; }
}

$("pullBtn").addEventListener("click", async () => {
  if (!online) { alert("Pehle ONLINE karo."); return; }
  const j = await pingServer();
  if (!j) { alert("Server is not found: " + lastErr); return; }
  const n = await pullAlerts();
  alert(n ? n + " alert(s) server se aaye/update hue" : "No new alerts from server.");
});

// --- live location share + tracking ("delivery app" jaisa) ---
let shareWatch = null, shareInfo = null, lastPost = 0;
let trackId = null, trackTimer = null, simTimer = null, simTeam = null;
const DEMO_PAT = { lat: 23.1765, lng: 75.7885 };   // sirf demo ke liye (Ujjain ke aas-paas)

function toRad(d) { return d * Math.PI / 180; }
function haversine(a, b) {
  const R = 6371000, dLat = toRad(b.lat - a.lat), dLng = toRad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function bearing(a, b) {
  const dL = toRad(b.lng - a.lng);
  const y = Math.sin(dL) * Math.cos(toRad(b.lat));
  const x = Math.cos(toRad(a.lat)) * Math.sin(toRad(b.lat)) - Math.sin(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.cos(dL);
  return Math.atan2(y, x);
}

function startShare(id, kind) {
  stopShare();
  if (!navigator.geolocation) { $("shareState").textContent = "GPS not available on this device."; return; }
  shareInfo = { id: id, kind: kind };
  $("shareState").textContent = "📡 " + (kind === "team" ? "Team ki" : "Aapki") + " live location being shared...";
  shareWatch = navigator.geolocation.watchPosition(p => {
    const pos = { lat: p.coords.latitude, lng: p.coords.longitude, acc: Math.round(p.coords.accuracy) };
    if (kind === "patient") {
      const c = cases.find(x => x.id === id);
      if (c) { c.lat = pos.lat; c.lng = pos.lng; c.acc = pos.acc; }
    }
    const now = Date.now();
    if (now - lastPost < 3000) return;
    lastPost = now;
    if (online) {
      fetch(apiBase + "/api/live", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caseId: id, kind: kind, lat: pos.lat, lng: pos.lng })
      }).catch(() => {});
    }
  }, err => {
    $("shareState").textContent = "⚠ location is unavailable: " + (err.code === 1 ? "permission denied" : err.message);
  }, { enableHighAccuracy: true, maximumAge: 2000, timeout: 20000 });
}

function stopShare() {
  if (shareWatch != null) navigator.geolocation.clearWatch(shareWatch);
  shareWatch = null; shareInfo = null;
}

function openTrack(id) {
  stopSim();
  trackId = id;
  const c = cases.find(x => x.id === id);
  if (!c) return;
  $("trackBox").style.display = "block";
  $("trackTitle").textContent = "Live tracking: " + c.name + " (" + c.desc + ")";
  $("trackMap").innerHTML =
    '<svg viewBox="0 0 300 300" width="100%" style="max-width:300px;">' +
    '<circle cx="150" cy="150" r="130" fill="#eef5fb" stroke="#9db7d0"/>' +
    '<circle cx="150" cy="150" r="87" fill="none" stroke="#c4d6e6" stroke-dasharray="4 4"/>' +
    '<circle cx="150" cy="150" r="43" fill="none" stroke="#c4d6e6" stroke-dasharray="4 4"/>' +
    '<text x="150" y="16" text-anchor="middle" font-size="11" fill="#555">N</text>' +
    '<text id="ringLbl" x="150" y="294" text-anchor="middle" font-size="11" fill="#555"></text>' +
    '<circle cx="150" cy="150" r="9" fill="#c62828"/>' +
    '<text x="150" y="176" text-anchor="middle" font-size="11" fill="#c62828" font-weight="bold">Patient</text>' +
    '<g id="teamG" style="display:none; transform:translate(0px,0px); transition:transform 1s linear;">' +
    '<circle cx="150" cy="150" r="9" fill="#0070c0"/>' +
    '<text x="150" y="134" text-anchor="middle" font-size="11" fill="#0070c0" font-weight="bold">Team</text></g>' +
    '</svg>';
  clearInterval(trackTimer);
  trackTimer = setInterval(pollTrack, 3000);
  pollTrack();
}

function stopTrack() {
  clearInterval(trackTimer); trackTimer = null;
  stopSim(); stopShare();
  trackId = null;
  $("trackBox").style.display = "none";
  $("shareState").textContent = "";
}

async function pollTrack() {
  if (!trackId || simTimer) return;
  const c = cases.find(x => x.id === trackId);
  if (!c) return;
  let live = {};
  if (online) {
    try {
      const r = await fetch(apiBase + "/api/live?caseId=" + encodeURIComponent(trackId), { cache: "no-store" });
      if (r.ok) live = await r.json();
    } catch (e) { /* offline ya server band: jo local hai wahi dikhao */ }
  }
  const pat = hasPos(live.patient) ? live.patient : (hasPos(c) ? { lat: +c.lat, lng: +c.lng } : null);
  drawTrack(c, pat, live.team || null, false);
}

function drawTrack(c, pat, team, demo) {
  const info = $("trackInfo"), links = $("trackLinks");
  if (!pat) {
    info.textContent = "Patient's location is not available yet. Please click 📍 GPS on the form.";
    links.textContent = "";
    $("teamG").style.display = "none";
    return;
  }
  let html = "📍 Patient: " + pat.lat.toFixed(5) + ", " + pat.lng.toFixed(5) + (demo ? " (DEMO location)" : "");
  const g = $("teamG");
  let range = 200;
  if (hasPos(team)) {
    const dist = haversine(pat, team), brg = bearing(pat, team);
    range = Math.max(150, dist * 1.25);
    const r = Math.min(130, dist / range * 130);
    g.style.display = "block";
    g.style.transform = "translate(" + (Math.sin(brg) * r).toFixed(1) + "px," + (-Math.cos(brg) * r).toFixed(1) + "px)";
    const eta = Math.max(1, Math.round(dist / (25000 / 60)));     // ~25 km/h maan ke, sirf andaza
    const dTxt = dist < 1000 ? Math.round(dist) + " m" : (dist / 1000).toFixed(1) + " km";
    html += "<br>🚑 Team: <b>" + dTxt + " Away</b>" + (dist < 30 ? " · ✅Team arrived." : " · ETA ≈ " + eta + " min (approx)");
    if (team.t && !demo) html += "<br><small>last update " + Math.max(0, Math.round((Date.now() - team.t) / 1000)) + " sec ago</small>";
    links.innerHTML = '<a href="' + osmLink(pat.lat, pat.lng) + '" target="_blank" rel="noopener">Patient map</a> · ' +
      '<a href="https://www.google.com/maps/dir/?api=1&origin=' + Number(team.lat) + ',' + Number(team.lng) +
      '&destination=' + Number(pat.lat) + ',' + Number(pat.lng) + '" target="_blank" rel="noopener">Show Route </a>';
  } else {
    g.style.display = "none";
    html += "<br>🚑 Team location not available. (Action required: Press 'I am responding'.)";
    links.innerHTML = '<a href="' + osmLink(pat.lat, pat.lng) + '" target="_blank" rel="noopener">Patient map</a>';
  }
  info.innerHTML = html;
  $("ringLbl").textContent = "bahari ring ≈ " + Math.round(range) + " m";
}

// --- Demo: ek hi laptop par tracking dikhane ke liye (asli GPS nahi, sirf simulation) ---
function stopSim() { clearInterval(simTimer); simTimer = null; simTeam = null; }

function startSim() {
  const c = cases.find(x => x.id === trackId);
  if (!c) { alert("Tap 'Track' on an alert first."); return; }
  stopSim();
  const pat = hasPos(c) ? { lat: +c.lat, lng: +c.lng } : DEMO_PAT;
  const d = 800;   // 800 m door se shuru
  simTeam = {
    lat: pat.lat + (d * Math.cos(Math.PI / 4)) / 111320,
    lng: pat.lng + (d * Math.sin(Math.PI / 4)) / (111320 * Math.cos(toRad(pat.lat)))
  };
  const tick = () => {
    simTeam.lat += (pat.lat - simTeam.lat) * 0.12;
    simTeam.lng += (pat.lng - simTeam.lng) * 0.12;
    drawTrack(c, pat, { lat: simTeam.lat, lng: simTeam.lng }, !hasPos(c));
    if (haversine(pat, simTeam) < 25) { clearInterval(simTimer); simTimer = null; }
  };
  tick();
  simTimer = setInterval(tick, 1000);
}

$("medList").addEventListener("click", (e) => {
  const act = e.target.dataset.act, id = e.target.dataset.id;
  if (!act || !id) return;
  const c = cases.find(x => x.id === id);
  if (!c) return;
  if (act === "track") { openTrack(id); return; }
  if (act === "respond") {
    if (!confirm("Live location will be shared with the emergency team for this alert. Proceed?")) return;
    c.status = "responding";
    c.synced = false;
    saveCases();
    renderCases();
    openTrack(id);
    startShare(id, "team");
    if (online) syncAll();
  }
});
$("simBtn").addEventListener("click", startSim);
$("stopBtn").addEventListener("click", stopTrack);

// ---------- 11. CROWD ZONES (simulated) ----------
const ZONES = [
  { n: "Ram Ghat", v: 55 },
  { n: "Mahakal Temple", v: 48 },
  { n: "Ujjain Railway Station", v: 62 },
  { n: "Datta Akhara Ghat", v: 35 },
  { n: "Parking Zone A", v: 30 }
];

function renderZones() {
  const hot = ZONES.filter(z => z.v >= 90);
  $("zones").innerHTML =
    hot.map(z => `<div style="background:#c62828;color:#fff;padding:8px;border-radius:6px;margin-bottom:6px;font-size:13px;font-weight:600;">⚠ ${esc(z.n)} at ${Math.round(z.v)}%: pilgrims ko alternate route par bhejein, extra staff lagayein</div>`).join("") +
    ZONES.map(z => {
      const col = z.v >= 90 ? "#c62828" : z.v >= 75 ? "#e0a100" : "#2e9e4f";
      return `<div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between"><b>${esc(z.n)}</b><span>${Math.round(z.v)}%</span></div>
        <div style="height:14px;background:#d6deea;border-radius:7px;overflow:hidden"><div style="width:${z.v}%;height:100%;background:${col};transition:width .6s"></div></div>
      </div>`;
    }).join("");
}

setInterval(() => {
  ZONES.forEach(z => {
    z.v = Math.max(10, Math.min(100, z.v + (Math.random() * 14 - 6) - (z.v > 85 ? 4 : 0)));
  });
  renderZones();
}, 2000);

$("surge").addEventListener("click", () => { ZONES[0].v = 96; renderZones(); });

// ---------- 12. PWA ----------
if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("sw.js")
    .then(() => console.log("Service worker ready"))
    .catch(err => console.log("SW error:", err));
}

// ---------- 13. START ----------
paintNet();
renderList();
fillPeople();
renderCases();
renderSMS();
renderZones();
pingServer().then(() => { if (online) syncAll().then(pullAlerts); });