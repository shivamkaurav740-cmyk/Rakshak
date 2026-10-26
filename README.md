# Rakshak

**Network-proof missing person alert and emergency system for Simhastha Kumbh 2028 (Ujjain, Madhya Pradesh).**

Team **The Creator** (ID: HSC|MP|00089) - Hack for Social Cause
Theme: *Disaster Mitigation, Kumbh Mela*

**Live demo (frontend):** https://shivamkaurav740-cmyk.github.io/Rakshak/
**Repository:** https://github.com/shivamkaurav740-cmyk/Rakshak

## Problem
At Kumbh-scale crowds, children, elderly and disabled pilgrims get separated from their families, mobile networks jam at peak hours, and traditional lost-and-found is manual and slow. There is also no single place where volunteers, medical teams and authorities can see missing-person cases and emergencies together.

## What Rakshak does
- **QR wristband:** name, age and family phone are stored in the QR, so it can be read with no internet.
- **Offline-first volunteer app (PWA):** everything is saved on the device first and synced to the server when the network returns.
- **Shared missing list:** volunteers see open missing reports with photo, description and last seen place.
- **Hindi voice description** (Web Speech API, `hi-IN`) and **rule-based matching** of found and missing reports (Hindi and English keywords).
- **Emergency tab:** medical alert with photo, video and GPS location, plus **live emergency-team tracking** (delivery-app style radar view with distance and ETA).
- **Crowd density by zone** with red alerts (simulated data in this prototype).

## What is simulated in this prototype (honest scope)
| Feature | Status |
|---|---|
| SMS to family | Simulated (shown in an SMS log, no real SMS is sent) |
| Crowd density | Simulated random data; camera/OpenCV analysis is planned |
| Matching | Rule-based keywords and age, not ML or face recognition |
| Login and roles | Not implemented (planned: separate logins for volunteer, police, medical team, admin) |

## Tech stack
HTML, CSS, JavaScript (no framework), Progressive Web App (Service Worker, localStorage, IndexedDB),
Node.js, Express, MongoDB Atlas (Mongoose), Web Speech API, Geolocation API, qrcodejs, jsQR.

## Project structure
```
index.html, app.js, style.css   frontend (PWA)
sw.js, manifest.json, icons     offline support
server/server.js                Express API + MongoDB
server/.env.example             environment template
docs/ARCHITECTURE.md            architecture and API
docs/TEST_CASES.md              manual test cases
sample-data/sample-data.json    sample people and cases
```

## Setup
**Requirements:** Node.js 18+, a free MongoDB Atlas cluster, Google Chrome.

1. **Clone**
   ```
   git clone https://github.com/shivamkaurav740-cmyk/Rakshak.git
   cd Rakshak
   ```
2. **Backend**
   ```
   cd server
   npm install
   ```
   Create a file named `.env` inside `server/` (copy `.env.example`) with one line:
   ```
   MONGO_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/rakshak?appName=rakshak
   ```
   In Atlas, create a database user and allow your IP (Network Access).
   Start the server:
   ```
   node server.js
   ```
   You should see `Rakshak server: http://localhost:3000` and `MongoDB connected`.
3. **Frontend:** open the project folder in VS Code and use the *Live Server* extension on `index.html` (it runs at `http://127.0.0.1:5500`). Allow microphone, camera and location when Chrome asks.
4. The header chip shows the server status (green means server and MongoDB are connected).

> Never commit `.env`. It is listed in `.gitignore`.

## Quick demo flow
1. Register a person and show the QR wristband.
2. Switch the header button to OFFLINE and report the person missing.
3. In another browser window, open the Volunteer tab and press "Naye reports lao"; the missing report appears.
4. Record a found person (speak in Hindi), confirm the match.
5. Switch to ONLINE and watch pending items sync.
6. Emergency tab: press GPS, submit an alert, then "Demo: team approaching".

## Documentation
- [Architecture and API](docs/ARCHITECTURE.md)
- [Test cases](docs/TEST_CASES.md)
- [Sample data](sample-data/sample-data.json)

## Team
- **Satyam Kourav** - Team lead, product and pitch, AI/ML
- **Shivam Kourav** - Full-stack and UI/UX

## License
MIT - see [LICENSE](LICENSE).
