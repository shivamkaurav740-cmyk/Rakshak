# Test cases (manual)

Automated tests are planned. These manual cases cover the main flows. Run the frontend on `http://127.0.0.1:5500` and the server on `http://localhost:3000`.

| ID | Test | Steps | Expected result |
|---|---|---|---|
| T1 | Register a person | Fill name, age, phone, description and press Register | Person appears in the list and a QR wristband is shown |
| T2 | Register without phone | Leave phone empty and press Register | Alert "Name and phone are required", nothing saved |
| T3 | QR content | Scan the QR with any scanner | Text like `RK|RK-1234|Name|Age|Phone` |
| T4 | Offline report | Press OFFLINE, report a person missing | Case shows "offline, not synced"; Pending increases |
| T5 | Auto sync | Press ONLINE | Alert "record(s) synced", Pending becomes 0, case visible in Atlas |
| T6 | No duplicates | Press ONLINE and OFFLINE several times | The same case appears only once in the database |
| T7 | Missing list for other volunteers | Open a second browser window (Incognito), Volunteer tab, press "Naye reports lao" | The missing report appears with photo and description |
| T8 | Hindi voice | Press the mic and say "laal kurta chashma ladka" | Text appears in the description box |
| T9 | Matching | Record a found person with similar description and age | A match with a percentage is shown |
| T10 | Confirm match | Press "Confirm & alert family" | Both cases become MATCHED and an SMS log entry is created |
| T11 | QR scan | Use the QR scan or paste the QR text in the found form | Person is identified; if a missing report exists it is matched automatically |
| T12 | SMS queued offline | Confirm a match while OFFLINE | SMS shows QUEUED; after ONLINE it shows SENT |
| T13 | Emergency with GPS | Emergency tab, press GPS, submit | Alert shows location link; tracking radar opens |
| T14 | Team tracking demo | Press "Demo: team approaching" | Team dot moves toward the patient, distance and ETA reduce |
| T15 | Server down | Stop the server | Header chip is red "Server: not reachable"; data stays on the device |
| T16 | Database connection | Open `/api/health` | `"db": "connected"` |
| T17 | Crowd alert | Press "Simulate surge at Ram Ghat" | A red alert appears for that zone |
| T18 | Offline app load | Load the app once, then set Chrome DevTools to Offline and refresh | App still opens from the service worker cache |
