# TIDELINE — Offline-First Marine Assistant

TIDELINE is an offline-first marine navigation, distress safety, vessel maintenance, and voyage logging assistant designed for seafaring vessels and artisanal fishermen operating without cellular or internet connectivity.

---

## Project Structure

```
TIDELINE/
├── prototype.html          # Original UI prototype reference
├── README.md               # Quickstart and execution guide
├── frontend/               # React + Vite frontend application
│   ├── index.html          # HTML entry with Oswald & IBM Plex typography
│   ├── package.json        # Dependencies & build scripts
│   ├── vite.config.js      # Vite build configuration
│   └── src/
│       ├── main.jsx        # React root mount
│       ├── App.jsx         # Shell with responsive modes & live API status
│       ├── index.css       # Marine design system tokens & animations
│       ├── components/
│       │   ├── StatusBar.jsx         # Clock, network pill, GPS pill, API status
│       │   ├── Header.jsx            # Wordmark & offline subtitle
│       │   ├── BottomNav.jsx         # Marine navigation tabs (HOME, MAP, SOS, FIX, LOGS)
│       │   ├── NewLogModal.jsx       # Modal to record offline voyage log entries
│       │   ├── NewMaintenanceModal.jsx # Modal to record maintenance entries
│       │   └── GuideModal.jsx        # Step-by-step emergency procedure modal
│       ├── utils/
│       │   └── indexedDb.js          # IndexedDB offline storage & SQLite auto-sync engine
│       └── views/
│           ├── HomeView.jsx          # Vessel position dial, quick access tiles, storage strip
│           ├── MapView.jsx           # Offline chart canvas, trajectory, GPS telemetry
│           ├── EmergencyView.jsx     # Distress SOS trigger & offline safety guides
│           ├── MaintenanceView.jsx   # Offline-first SQLite maintenance records & status chips
│           └── LogsView.jsx          # SQLite voyage logs with interactive (+) FAB & delete
└── backend/                    # Spring Boot REST API (Java 21)
    ├── pom.xml                 # Maven: Spring WebMVC + JDBC + SQLite JDBC driver
    ├── mvnw                    # Unix/macOS Maven wrapper script
    ├── mvnw.cmd                # Windows Maven wrapper batch script (auto-detects JDK 21)
    ├── data/                   # Auto-created on first run — NOT committed to VCS
    │   └── tideline.db         # SQLite database file with voyage_logs & maintenance_records
    ├── .mvn/wrapper/           # Maven wrapper distribution files
    └── src/
        ├── main/
        │   ├── java/com/tideline/backend/
        │   │   ├── BackendApplication.java         # Main entry point
        │   │   ├── config/
        │   │   │   └── CorsConfig.java             # CORS configuration for React frontend
        │   │   ├── model/
        │   │   │   ├── VoyageLog.java              # VoyageLog entity (id, dates, ports, notes)
        │   │   │   └── MaintenanceRecord.java      # MaintenanceRecord entity (id, equipment, status)
        │   │   ├── repository/
        │   │   │   ├── VoyageLogRepository.java    # SQLite data access for voyage logs
        │   │   │   └── MaintenanceRecordRepository.java # SQLite data access for maintenance
        │   │   ├── service/
        │   │   │   ├── DatabaseService.java        # SQLite schema auto-init & connection probe
        │   │   │   ├── VoyageLogService.java       # Business logic for voyage logs
        │   │   │   └── MaintenanceRecordService.java # Business logic for maintenance records
        │   │   └── controller/
        │   │       ├── HealthController.java       # GET /api/health -> {"status":"UP"}
        │   │       ├── DatabaseController.java     # GET /api/database/status -> SQLite status
        │   │       ├── VoyageLogController.java    # REST CRUD for /api/voyages
        │   │       └── MaintenanceRecordController.java # REST CRUD for /api/maintenance
        │   └── resources/
        │       └── application.properties          # Server port 8080 + SQLite datasource URL
        └── test/
            └── java/com/tideline/backend/
                ├── BackendApplicationTests.java        # Context load test
                ├── HealthControllerTest.java           # MockMvc test for /api/health
                ├── DatabaseControllerTest.java         # MockMvc tests for /api/database/status
                ├── VoyageLogControllerTest.java        # MockMvc tests for /api/voyages endpoints
                └── MaintenanceRecordControllerTest.java # MockMvc tests for /api/maintenance endpoints
```

---

## Prerequisites

- **Java**: Java 21 JDK installed (`javac 21.x` and `java 21.x`).
- **Node.js**: Node.js 18+ (`node -v` and `npm -v`).
- **Maven**: *Not required!* The project includes the official **Maven Wrapper** (`mvnw` / `mvnw.cmd`).

---

## Exact Commands to Run Locally

### 1. Start the Java Backend

Open a terminal in the root `TIDELINE` directory:

```bash
cd backend
```

#### On Windows (PowerShell or Command Prompt):
```cmd
mvnw.cmd spring-boot:run
```

#### On macOS / Linux:
```bash
chmod +x mvnw
./mvnw spring-boot:run
```

The Spring Boot backend will start on **`http://localhost:8080`**.

#### Verify Backend Health:
In another terminal, test the health endpoint:
```bash
curl http://localhost:8080/api/health
```
**Expected Response:**
```json
{"status":"UP"}
```

---

## SQLite Local Database

TIDELINE uses **SQLite** as its embedded, offline-first local database — no external database server required.

### Key Details

| Property | Value |
|---|---|
| Engine | SQLite 3.46.1 (Xerial JDBC driver) |
| Database file | `backend/data/tideline.db` |
| JDBC URL | `jdbc:sqlite:./data/tideline.db` |
| Connection pool | HikariCP (pool size = 1, SQLite single-writer model) |
| Data directory | Auto-created on first backend startup |
| Schema init | Manual (`spring.sql.init.mode=never`) |

### Data Directory

The `backend/data/` directory and `tideline.db` file are created automatically when Spring Boot starts for the first time. The `data/` directory should be added to `.gitignore` to avoid committing the database file.

### Test the Database Endpoint

After starting the backend, confirm SQLite connectivity:

```bash
curl http://localhost:8080/api/database/status
```

**Expected response (HTTP 200):**
```json
{
  "database": "SQLite",
  "location": "/absolute/path/to/TIDELINE/backend/data/tideline.db",
  "status": "CONNECTED",
  "engine": "SQLite",
  "version": "3.46.1",
  "fileExists": true,
  "connectionOk": true
}
```

If the database cannot be reached, the endpoint returns **HTTP 503** with `"status": "ERROR"`.

---

## Voyage Logs Database & REST API

TIDELINE records maritime voyages directly into the local SQLite database inside table `voyage_logs`.

### SQLite Schema (`voyage_logs`)

```sql
CREATE TABLE IF NOT EXISTS voyage_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voyage_date TEXT NOT NULL,
    departure TEXT NOT NULL,
    destination TEXT NOT NULL,
    vessel_name TEXT NOT NULL,
    notes TEXT,
    created_at TEXT NOT NULL
);
```

### Endpoints

| Method | Endpoint | Description | Status Code |
|---|---|---|---|
| `GET` | `/api/voyages` | Retrieve all saved voyage logs | `200 OK` |
| `GET` | `/api/voyages/{id}` | Retrieve a specific voyage log | `200 OK` / `404 Not Found` |
| `POST` | `/api/voyages` | Create a new voyage log in SQLite | `201 Created` |
| `DELETE` | `/api/voyages/{id}` | Delete a voyage log by ID | `204 No Content` / `404 Not Found` |

### Example Payloads

#### Create Voyage (`POST /api/voyages`):
```json
{
  "voyageDate": "2026-09-18",
  "departure": "Vizhinjam Harbour",
  "destination": "Arabian Sea Sector 4",
  "vesselName": "TIDELINE-01",
  "notes": "Departed 05:12 - sea state calm"
}
```

#### Response (`201 Created`):
```json
{
  "id": 1,
  "voyageDate": "2026-09-18",
  "departure": "Vizhinjam Harbour",
  "destination": "Arabian Sea Sector 4",
  "vesselName": "TIDELINE-01",
  "notes": "Departed 05:12 - sea state calm",
  "createdAt": "2026-09-18T05:53:35.027Z"
}
```

### Test Voyage Endpoints with cURL

```bash
# 1. List all voyages
curl http://localhost:8080/api/voyages

# 2. Add a new voyage
curl -X POST http://localhost:8080/api/voyages \
  -H "Content-Type: application/json" \
  -d '{"voyageDate":"2026-09-18","departure":"Vizhinjam","destination":"Sector 4","vesselName":"TIDELINE-01","notes":"Engine nominal"}'

# 3. Get voyage by ID
curl http://localhost:8080/api/voyages/1

### Test Maintenance Endpoints with cURL

```bash
# 1. List all maintenance records
curl http://localhost:8080/api/maintenance

# 2. Add a new maintenance record
curl -X POST http://localhost:8080/api/maintenance \
  -H "Content-Type: application/json" \
  -d '{"vesselName":"TIDELINE-01","equipment":"Bilge Pump","maintenanceDate":"2026-09-18","nextServiceDate":"2026-10-18","status":"OK","notes":"Impeller checked"}'

# 3. Get maintenance record by ID
curl http://localhost:8080/api/maintenance/1

# 4. Delete maintenance record by ID
curl -X DELETE http://localhost:8080/api/maintenance/1
```

---

## 2. Start the Frontend (React + Vite)

Open a new terminal in the root `TIDELINE` directory:

```bash
cd frontend
npm install
npm run dev
```

The React Vite application will start on **`http://localhost:5173`**.

Open **`http://localhost:5173`** in your browser.

---

## Build & Test Commands

### Build Frontend:
```bash
cd frontend
npm run build
```
Production assets will be built to `frontend/dist/`.

### Test & Package Backend:
```bash
cd backend
mvnw.cmd test package
```
*(Or `./mvnw test package` on macOS/Linux)*

Runs all 37 automated unit & integration tests and creates the executable JAR at `backend/target/backend-0.0.1-SNAPSHOT.jar`.

---

## Local AI Marine Assistant (100% Offline & Verified Grounded)

TIDELINE features a dedicated **Local AI Assistant** designed for zero-connectivity seafaring environments. It combines high-speed deterministic access to authenticated on-board data with a local large language model runtime (**Ollama**).

### Core Operational Directives

1. **100% Local & Offline**: All computation occurs entirely on the local device or vessel bridge computer. No telemetry, internet connection, or external cloud API keys are required or contacted.
2. **Strict Grounding in Verified On-Board Data**:
   - **Hardware GPS Fix & Telemetry**: Current authentic latitude, longitude, speed over ground, heading, and accuracy.
   - **Voyage Logs**: Recent and historical voyage entries from local SQLite and IndexedDB.
   - **Equipment Maintenance**: Logged condition, servicing dates, and upcoming inspections.
   - **Emergency Distress Events**: Incident history and verified transmission statuses (`TRANSMITTED` vs `PENDING_TRANSMISSION`).
   - **Offline Emergency Guides**: Tactical step-by-step checklists for MOB, Fire, Signals, First Aid, and Storms.
   - **Cached Nautical Chart Data**: Coastal sectors, Vizhinjam approach aids, beacons, and shoals.
3. **Zero Fabrication Safety Mandate**:
   - Never fabricates coordinates, voyage logs, or false rescue transmission confirmations.
   - If telemetry or records are unavailable, explicitly states: `"Verified data is unavailable."`
   - Meteorological safety policy: Refuses to fabricate live weather, wind speeds, or sea state forecasts without certified physical sensors.
4. **Clear Sourcing Distinction**:
   - Stored on-board records are strictly labeled: `[VERIFIED TIDELINE DATA]`.
   - General nautical knowledge and seamanship questions are labeled: `[GENERAL MARITIME KNOWLEDGE]`.
5. **Deterministic Fallback Engine**:
   - If the local LLM runtime (Ollama) is stopped or unavailable, 100% of vessel-specific questions (GPS, logs, gear, emergencies, procedures, charts) continue to resolve deterministically from local storage with zero delay.
   - The UI displays a clear `MODEL UNAVAILABLE` state with a copyable terminal command to launch Ollama.

---

## Ollama Local Inference Runtime Setup

### 1. Install Ollama

- **Windows**: Download installer from [ollama.com/download/windows](https://ollama.com/download/windows) and run the setup.
- **macOS**: Download from [ollama.com/download/mac](https://ollama.com/download/mac) or install via Homebrew: `brew install ollama`.
- **Linux**: Run `curl -fsSL https://ollama.com/install.sh | sh`.

### 2. Pull & Run the Recommended Model

TIDELINE is pre-configured for `llama3.2:1b` (a fast, ultra-compact 1-billion-parameter local model requiring ~1.3 GB RAM):

```bash
ollama run llama3.2:1b
```

*(Alternatively, you can pull any other installed model, such as `phi3:mini`, `qwen2.5:1.5b`, or `llama3.2:3b`. TIDELINE automatically discovers installed models).*

### 3. Verify Ollama Runtime

Confirm Ollama is running locally:

```bash
curl http://localhost:11434/api/tags
```

---

## Assistant REST API Endpoints

The Spring Boot backend exposes REST endpoints under `/api/assistant`:

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/assistant` | System metadata, offline mode, and safety directives |
| `GET` | `/api/assistant/status` | Runtime connectivity probe & list of installed models |
| `GET` | `/api/assistant/models` | List of installed local models available for inference |
| `POST` | `/api/assistant/chat` | Process natural language query grounded in verified data |

### Example cURL Queries

#### 1. Check Assistant Status:
```bash
curl http://localhost:8080/api/assistant/status
```

#### 2. Query Verified GPS Telemetry:
```bash
curl -X POST http://localhost:8080/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "What is our current verified GPS fix?",
    "context": {
      "gps": {
        "latitude": 8.3758,
        "longitude": 76.9900,
        "accuracy": 4.5,
        "speed": 3.8,
        "heading": 182.0,
        "source": "DEVICE_HARDWARE_GNSS"
      }
    }
  }'
```

#### 3. Query Recent Voyage Logs:
```bash
curl -X POST http://localhost:8080/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What were our recent voyages and routes?"}'
```

#### 4. Query Emergency Procedures (MOB):
```bash
curl -X POST http://localhost:8080/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is the Man Overboard MOB procedure?"}'
```

#### 5. Weather Anti-Fabrication Safety Test:
```bash
curl -X POST http://localhost:8080/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{"query": "What is tomorrow'\''s wave and weather forecast?"}'
```
*Response: Rejection with certified meteorological safety policy.*

#### 6. General Maritime Question (Local LLM Inference):
```bash
curl -X POST http://localhost:8080/api/assistant/chat \
  -H "Content-Type: application/json" \
  -d '{
    "query": "Explain how a marine diesel injector works and how to bleed fuel airlocks.",
    "model": "llama3.2:1b"
  }'
```

---

## Offline & Airgapped Verification Steps

To verify that TIDELINE operates 100% offline:

1. **Disconnect Network**: Turn off Wi-Fi and unplug all Ethernet cables on your device.
2. **Access TIDELINE**: Open `http://localhost:5173` in your browser.
3. **Inspect Airgap Pill**: The top bar displays `AIRGAPPED LOCAL` with green indicators.
4. **Trigger Quick Queries**: Click the `⚡` Assistant button in the top bar. Try:
   - `📍 Verified GPS` -> Returns genuine stored coordinates with accuracy and heading.
   - `📜 Recent Voyages` -> Returns verified logs from IndexedDB / SQLite.
   - `📖 Offline Guides` -> Returns MOB procedure steps immediately.
   - `🌊 Weather Check` -> Returns safety policy refusing meteorological fabrication.
5. **Model Unavailable Handling**: Stop Ollama (`Ctrl+C`). Run any query in the assistant modal. Notice that:
   - Vessel queries still return verified data deterministically with `VERIFIED TIDELINE DATA` badge.
   - General questions display the `MODEL UNAVAILABLE` alert with a one-click copy button for `ollama run llama3.2:1b`.
   - No crashes, unhandled rejections, or hanging queries occur.

---

## Features & UI Reference

- **Design Fidelity**: Faithfully preserves all visual elements, colors (`--navy-deep: #081826`, `--sonar: #17D9A3`, `--alert: #FF4F4F`, `--amber: #FFB020`), radar sweep animations, and typography (`Oswald`, `IBM Plex Sans`, `IBM Plex Mono`) from `prototype.html`.
- **Responsive Modes**:
  - **Handheld Frame**: Sleek smartphone simulator with camera notch.
  - **Bridge Console**: Widescreen dual-panel marine bridge display for laptops and widescreen monitors.
  - **Mobile**: Edge-to-edge native layout on phone screens.
- **Local Marine AI Assistant**: Grounded local intelligence, zero-cloud dependency, multi-model support, session query history log, and airgap detection.
- **Vessel Telemetry**: Live coordinates, radar dial, heading, speed, and accuracy badge.
- **Offline Safety Guides**: Step-by-step checklists for Man Overboard, Engine Room Fire, Distress Signals, First Aid, and Storm Protocols.
- **Offline-First Maintenance Records (IndexedDB + SQLite)**:
  - Equipment service records saved to SQLite (`maintenance_records` table).
  - Offline entries queue in IndexedDB store `pending_maintenance` with `PENDING SYNC` chip.
  - Automatic synchronization to `POST /api/maintenance` on reconnect with duplicate prevention.
- **Offline-First Voyage Logs (IndexedDB + SQLite)**:
  - When backend is unavailable, new voyage logs are safely stored in the browser's **IndexedDB** (`tideline_offline_db` / `pending_voyages`).
  - Locally created offline records are flagged with a prominent **`PENDING SYNC`** chip.
  - Active UI badges clearly indicate **`ONLINE`** / **`OFFLINE`** and **`⟳ N PENDING SYNC`**.
  - As soon as the backend reconnects, the background synchronizer auto-syncs pending records via `POST /api/voyages`.
  - Records are ONLY marked **`SYNCED`** upon explicit HTTP 201/200 confirmation from the Spring Boot backend.
  - Synchronization incorporates mutex locking and state validation to completely eliminate duplicate records.
- **Live Health Status**: Real-time polling indicator in the top status bar displaying `API: UP` when connected to the Spring Boot REST backend.

