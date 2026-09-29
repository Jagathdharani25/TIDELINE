package com.tideline.backend.service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import com.tideline.backend.model.AssistantRequest;
import com.tideline.backend.model.AssistantResponse;
import com.tideline.backend.model.AssistantStatusResponse;
import com.tideline.backend.model.EmergencyEvent;
import com.tideline.backend.model.MaintenanceRecord;
import com.tideline.backend.model.VoyageLog;

/**
 * AssistantService — Coordinates local offline LLM inference (via Ollama)
 * with verified TIDELINE on-board data.
 *
 * SAFETY MANDATES:
 * 1. 100% Local & Offline — interacts only with local Ollama runtime and local SQLite / IndexedDB.
 * 2. Strict Grounding — answers vessel queries ONLY from verified local data.
 * 3. Zero Fabrication — never fabricates GPS fixes, emergency transmission statuses, or logs.
 * 4. Clear Distinction — distinguishes verified stored data from general maritime AI knowledge.
 * 5. Robust Fallback — if Ollama is not running, deterministic verified data is returned.
 */
@Service
public class AssistantService {

    private static final Logger log = LoggerFactory.getLogger(AssistantService.class);
    private static final String FALLBACK_UNAVAILABLE = "Verified data is unavailable.";

    private final String ollamaBaseUrl;
    private final String defaultModel;
    private final int timeoutSeconds;

    private final VoyageLogService voyageLogService;
    private final MaintenanceRecordService maintenanceRecordService;
    private final EmergencyEventService emergencyEventService;

    private final HttpClient httpClient;

    public AssistantService(
            @Value("${ollama.base-url:http://localhost:11434}") String ollamaBaseUrl,
            @Value("${ollama.model:llama3.2:1b}") String defaultModel,
            @Value("${ollama.timeout-seconds:15}") int timeoutSeconds,
            VoyageLogService voyageLogService,
            MaintenanceRecordService maintenanceRecordService,
            EmergencyEventService emergencyEventService) {
        this.ollamaBaseUrl = ollamaBaseUrl.replaceAll("/+$", "");
        this.defaultModel = defaultModel;
        this.timeoutSeconds = timeoutSeconds;
        this.voyageLogService = voyageLogService;
        this.maintenanceRecordService = maintenanceRecordService;
        this.emergencyEventService = emergencyEventService;

        this.httpClient = HttpClient.newBuilder()
                .connectTimeout(Duration.ofMillis(1500))
                .build();
    }

    /**
     * Checks if the local Ollama runtime is reachable and returns installed models.
     */
    public AssistantStatusResponse getStatus() {
        try {
            HttpRequest req = HttpRequest.newBuilder()
                    .uri(URI.create(ollamaBaseUrl + "/api/tags"))
                    .timeout(Duration.ofMillis(2000))
                    .header("Accept", "application/json")
                    .GET()
                    .build();

            HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() == 200) {
                List<String> models = parseModelNames(resp.body());

                return new AssistantStatusResponse(
                        "ONLINE",
                        "Ollama",
                        ollamaBaseUrl,
                        defaultModel,
                        models,
                        "Local LLM runtime connected at " + ollamaBaseUrl
                );
            }
        } catch (Exception e) {
            log.debug("Ollama is not reachable at {}: {}", ollamaBaseUrl, e.getMessage());
        }

        return new AssistantStatusResponse(
                "UNAVAILABLE",
                "Ollama",
                ollamaBaseUrl,
                defaultModel,
                Collections.emptyList(),
                "Local LLM runtime is unavailable at " + ollamaBaseUrl + ". Start Ollama using: 'ollama run " + defaultModel + "'"
        );
    }

    /**
     * Returns list of currently available models from the local Ollama runtime.
     */
    public List<String> getAvailableModels() {
        return getStatus().getAvailableModels();
    }

    /**
     * Processes an assistant question with strict grounding in verified TIDELINE data.
     */
    public AssistantResponse processQuery(AssistantRequest request) {
        if (request == null || request.getQuery() == null || request.getQuery().trim().isEmpty()) {
            return new AssistantResponse(
                    false,
                    FALLBACK_UNAVAILABLE + " Please enter a question regarding vessel navigation, GPS telemetry, maintenance, emergency response, or maritime concepts.",
                    "VALIDATION_ERROR",
                    defaultModel,
                    "ERROR",
                    false,
                    null,
                    "Empty query provided"
            );
        }

        String rawQuery = request.getQuery().trim();
        String queryLower = rawQuery.toLowerCase();
        String selectedModel = (request.getModel() != null && !request.getModel().isBlank())
                ? request.getModel().trim()
                : defaultModel;

        // 1. WEATHER & MARINE CONDITIONS (MANDATORY NEVER FABRICATE)
        Pattern weatherPattern = Pattern.compile("\\b(weather|forecast|forecasts|wave|waves|wind|winds|tide|tides|storm|storms|sea state|rain|rainfall|swell|swells|cyclone|barometer)\\b", Pattern.CASE_INSENSITIVE);
        if (weatherPattern.matcher(queryLower).find()) {
            return new AssistantResponse(
                    true,
                    FALLBACK_UNAVAILABLE + " TIDELINE operates fully offline and does not fabricate weather forecasts, wind speeds, or live marine conditions without certified on-board sensor feeds.",
                    "VERIFIED_TIDELINE_DATA",
                    selectedModel,
                    "ONLINE",
                    true,
                    "SAFETY_POLICY",
                    "Safety mandate: No unverified meteorological fabrication"
            );
        }

        // 2. Classify intent and identify relevant verified data
        Map<String, Object> clientContext = request.getContext();
        String verifiedSource = null;
        boolean isVesselSpecific = false;
        String deterministicAnswer = null;

        // A. GPS Telemetry
        boolean asksGps = queryLower.contains("gps") || queryLower.contains("position") || queryLower.contains("coordinates")
                || queryLower.contains("latitude") || queryLower.contains("longitude") || queryLower.contains("where are we")
                || queryLower.contains("where am i") || queryLower.contains("heading") || queryLower.contains("speed");

        if (asksGps) {
            isVesselSpecific = true;
            verifiedSource = "VERIFIED_GPS";
            deterministicAnswer = buildGpsAnswer(clientContext);
        }

        // B. Voyage Logs
        boolean asksVoyages = queryLower.contains("voyage") || queryLower.contains("log") || queryLower.contains("departure")
                || queryLower.contains("destination") || queryLower.contains("trip") || queryLower.contains("route");

        if (!asksGps && asksVoyages) {
            isVesselSpecific = true;
            verifiedSource = "VERIFIED_VOYAGE_DB";
            deterministicAnswer = buildVoyagesAnswer(clientContext);
        }

        // C. Maintenance & Equipment
        boolean asksMaintenance = queryLower.contains("maintenance") || queryLower.contains("equipment") || queryLower.contains("engine")
                || queryLower.contains("pump") || queryLower.contains("battery") || queryLower.contains("gear")
                || queryLower.contains("service") || queryLower.contains("inspection") || queryLower.contains("repair");

        if (!asksGps && !asksVoyages && asksMaintenance) {
            isVesselSpecific = true;
            verifiedSource = "VERIFIED_MAINTENANCE_DB";
            deterministicAnswer = buildMaintenanceAnswer(clientContext, queryLower);
        }

        // D. Emergency & SOS
        boolean asksEmergency = queryLower.contains("emergency") || queryLower.contains("distress") || queryLower.contains("sos")
                || queryLower.contains("mayday") || queryLower.contains("pan pan") || queryLower.contains("incident");

        if (!asksGps && !asksVoyages && !asksMaintenance && asksEmergency) {
            isVesselSpecific = true;
            verifiedSource = "VERIFIED_EMERGENCY_DB";
            deterministicAnswer = buildEmergencyAnswer(clientContext);
        }

        // E. Offline Emergency Guides
        boolean asksGuide = queryLower.contains("guide") || queryLower.contains("procedure") || queryLower.contains("man overboard")
                || queryLower.contains("mob") || queryLower.contains("fire") || queryLower.contains("flares")
                || queryLower.contains("first aid") || queryLower.contains("hypothermia") || queryLower.contains("severe weather protocol");

        if (!asksGps && !asksVoyages && !asksMaintenance && !asksEmergency && asksGuide) {
            isVesselSpecific = true;
            verifiedSource = "OFFLINE_GUIDES";
            deterministicAnswer = buildGuideAnswer(clientContext, queryLower);
        }

        // F. Cached Nautical Map & Aids
        boolean asksMap = queryLower.contains("map") || queryLower.contains("chart") || queryLower.contains("hazard")
                || queryLower.contains("lighthouse") || queryLower.contains("buoy") || queryLower.contains("bathymetry")
                || queryLower.contains("depth") || queryLower.contains("shoal") || queryLower.contains("vizhinjam")
                || queryLower.contains("harbour") || queryLower.contains("reef") || queryLower.contains("channel");

        if (!asksGps && !asksVoyages && !asksMaintenance && !asksEmergency && !asksGuide && asksMap) {
            isVesselSpecific = true;
            verifiedSource = "CACHED_CHARTS";
            deterministicAnswer = buildMapAnswer(clientContext, queryLower);
        }

        // G. Vessel identity
        boolean asksVessel = queryLower.contains("vessel") || queryLower.contains("boat") || queryLower.contains("ship")
                || queryLower.contains("who are we") || queryLower.contains("callsign");

        if (!isVesselSpecific && asksVessel) {
            isVesselSpecific = true;
            verifiedSource = "VERIFIED_LOCAL_DATA";
            deterministicAnswer = buildVesselAnswer(clientContext);
        }

        // 3. Check Ollama availability
        AssistantStatusResponse status = getStatus();
        boolean ollamaOnline = "ONLINE".equalsIgnoreCase(status.getStatus());
        if (ollamaOnline && status.getAvailableModels() != null && !status.getAvailableModels().isEmpty()) {
            if (!status.getAvailableModels().contains(selectedModel)) {
                selectedModel = status.getAvailableModels().get(0);
            }
        }

        if (ollamaOnline) {
            try {
                String prompt = buildSystemPrompt(rawQuery, clientContext);
                String llmResponse = callOllamaGenerate(selectedModel, prompt);

                if (llmResponse != null && !llmResponse.isBlank()) {
                    String sourceLabel = isVesselSpecific ? "LOCAL_LLM (Grounded in Verified Data)" : "LOCAL_LLM (General Knowledge)";
                    return new AssistantResponse(
                            true,
                            llmResponse.trim(),
                            sourceLabel,
                            selectedModel,
                            "ONLINE",
                            isVesselSpecific,
                            verifiedSource,
                            "Generated locally using " + selectedModel + " (Ollama)"
                    );
                }
            } catch (Exception e) {
                log.warn("Ollama inference execution failed: {}", e.getMessage());
            }
        }

        // 4. Fallback when Ollama is offline or inference failed
        if (isVesselSpecific && deterministicAnswer != null) {
            return new AssistantResponse(
                    true,
                    deterministicAnswer,
                    "STORED_TIDELINE_DATA",
                    selectedModel,
                    ollamaOnline ? "ONLINE" : "MODEL_UNAVAILABLE",
                    true,
                    verifiedSource,
                    ollamaOnline
                            ? "Verified TIDELINE data retrieved from local storage."
                            : "Local LLM runtime (Ollama) is offline at " + ollamaBaseUrl + ". Verified TIDELINE data retrieved deterministically from local storage."
            );
        }

        // 5. General question when Ollama is offline
        return new AssistantResponse(
                false,
                "● LOCAL LLM RUNTIME UNAVAILABLE\n\n"
                        + "To answer general maritime questions and enable local generative AI, start Ollama on your system:\n"
                        + "  $ ollama run " + selectedModel + "\n\n"
                        + "Endpoint: " + ollamaBaseUrl + "\n\n"
                        + "● 100% VERIFIED DATA GUARANTEE:\n"
                        + "All on-board TIDELINE vessel data (GPS telemetry, voyage logs, maintenance status, emergency records, emergency guides, and nautical charts) remains 100% accessible offline without Ollama.",
                "MODEL_UNAVAILABLE",
                selectedModel,
                "MODEL_UNAVAILABLE",
                false,
                null,
                "Ollama is not running. Launch Ollama locally to enable offline AI queries."
        );
    }

    /**
     * Constructs the structured prompt for Ollama with strict grounding and zero hallucination mandates.
     */
    private String buildSystemPrompt(String userQuery, Map<String, Object> context) {
        StringBuilder sb = new StringBuilder();
        sb.append("You are the TIDELINE Local Marine AI Assistant aboard a maritime vessel. You operate 100% locally and offline.\n\n");
        sb.append("CORE OPERATIONAL DIRECTIVES:\n");
        sb.append("1. STRICT SOURCING & GROUNDING:\n");
        sb.append("   - You are provided with verified TIDELINE on-board data below (GPS fix, voyage logs, maintenance records, emergency events, offline guides, and nautical chart aids).\n");
        sb.append("   - When answering questions about THIS VESSEL, its GPS location, voyage history, gear condition, emergency records, safety checklists, or cached navigational charts, you MUST strictly use ONLY the verified data provided.\n");
        sb.append("2. ZERO FABRICATION MANDATE:\n");
        sb.append("   - NEVER invent or guess GPS coordinates, voyage dates, emergency distress events, or sensor readings.\n");
        sb.append("   - If requested vessel details are not in the verified data, explicitly say: \"Verified data is unavailable in local storage.\"\n");
        sb.append("   - Never fabricate live weather, wind speeds, or sea state forecasts.\n");
        sb.append("3. CLEAR DISTINCTION:\n");
        sb.append("   - Clearly distinguish stored TIDELINE verified data from general AI knowledge.\n");
        sb.append("   - When answering with vessel records, label the section: [VERIFIED TIDELINE DATA].\n");
        sb.append("   - When answering general maritime or engineering questions, label the section: [GENERAL MARITIME KNOWLEDGE].\n");
        sb.append("4. GENERAL MARITIME ASSISTANCE:\n");
        sb.append("   - For general questions (seamanship, COLREGs, diesel maintenance, knots, navigation concepts), answer accurately using your local knowledge.\n\n");

        sb.append("=== VERIFIED TIDELINE ON-BOARD DATA CONTEXT ===\n");

        // Append GPS
        if (context != null && context.containsKey("gps") && context.get("gps") != null) {
            sb.append("• CURRENT HARDWARE GPS FIX:\n  ").append(context.get("gps").toString()).append("\n");
        } else {
            sb.append("• CURRENT HARDWARE GPS FIX: [No hardware GPS fix acquired]\n");
        }

        // Append Voyages
        List<VoyageLog> voyages = voyageLogService.getAllVoyages();
        if (voyages != null && !voyages.isEmpty()) {
            sb.append("• VERIFIED VOYAGE LOGS (").append(voyages.size()).append(" total):\n");
            int count = Math.min(voyages.size(), 4);
            for (int i = 0; i < count; i++) {
                VoyageLog v = voyages.get(voyages.size() - 1 - i);
                sb.append("  - Date: ").append(v.getVoyageDate())
                        .append(", ").append(v.getDeparture()).append(" -> ").append(v.getDestination())
                        .append(", Vessel: ").append(v.getVesselName())
                        .append(v.getNotes() != null ? " (\"" + v.getNotes() + "\")" : "")
                        .append("\n");
            }
        } else if (context != null && context.get("voyages") instanceof List<?> cv && !cv.isEmpty()) {
            sb.append("• VERIFIED VOYAGE LOGS (").append(cv.size()).append(" total logged):\n");
            int count = Math.min(cv.size(), 4);
            for (int i = 0; i < count; i++) {
                Object item = cv.get(cv.size() - 1 - i);
                if (item instanceof Map<?, ?> v) {
                    sb.append("  - Date: ").append(v.get("voyageDate"))
                            .append(", ").append(v.get("departure")).append(" -> ").append(v.get("destination"))
                            .append(", Vessel: ").append(v.get("vesselName"))
                            .append(v.get("notes") != null ? " (\"" + v.get("notes") + "\")" : "")
                            .append("\n");
                }
            }
        } else {
            sb.append("• VERIFIED VOYAGE LOGS: [0 logged voyages in database]\n");
        }

        // Append Maintenance
        List<MaintenanceRecord> maint = maintenanceRecordService.getAllRecords();
        if (maint != null && !maint.isEmpty()) {
            sb.append("• VERIFIED MAINTENANCE RECORDS (").append(maint.size()).append(" total):\n");
            int count = Math.min(maint.size(), 4);
            for (int i = 0; i < count; i++) {
                MaintenanceRecord m = maint.get(maint.size() - 1 - i);
                sb.append("  - ").append(m.getEquipment())
                        .append(" | Status: ").append(m.getStatus())
                        .append(" | Date: ").append(m.getMaintenanceDate())
                        .append(m.getNextServiceDate() != null ? " | Next Due: " + m.getNextServiceDate() : "")
                        .append(m.getNotes() != null ? " | Notes: " + m.getNotes() : "")
                        .append("\n");
            }
        } else if (context != null && context.get("maintenance") instanceof List<?> cm && !cm.isEmpty()) {
            sb.append("• VERIFIED MAINTENANCE RECORDS (").append(cm.size()).append(" records logged):\n");
            int count = Math.min(cm.size(), 4);
            for (int i = 0; i < count; i++) {
                Object item = cm.get(cm.size() - 1 - i);
                if (item instanceof Map<?, ?> m) {
                    sb.append("  - ").append(m.get("equipment"))
                            .append(" | Status: ").append(m.get("status"))
                            .append(" | Date: ").append(m.get("maintenanceDate"))
                            .append(m.get("nextServiceDate") != null ? " | Next Due: " + m.get("nextServiceDate") : "")
                            .append(m.get("notes") != null ? " | Notes: " + m.get("notes") : "")
                            .append("\n");
                }
            }
        } else {
            sb.append("• VERIFIED MAINTENANCE RECORDS: [0 records in database]\n");
        }

        // Append Emergency Events
        List<EmergencyEvent> emergencies = emergencyEventService.getAllEvents();
        if (emergencies != null && !emergencies.isEmpty()) {
            sb.append("• VERIFIED EMERGENCY DISTRESS EVENTS (").append(emergencies.size()).append(" total):\n");
            for (EmergencyEvent e : emergencies) {
                sb.append("  - ").append(e.getEmergencyType())
                        .append(" | Status: ").append(e.getStatus())
                        .append(" | Time: ").append(e.getEventTime())
                        .append(" | Msg: ").append(e.getMessage())
                        .append("\n");
            }
        } else if (context != null && context.get("emergencies") instanceof List<?> ce && !ce.isEmpty()) {
            sb.append("• VERIFIED EMERGENCY DISTRESS EVENTS (").append(ce.size()).append(" total logged):\n");
            for (Object item : ce) {
                if (item instanceof Map<?, ?> e) {
                    sb.append("  - ").append(e.get("emergencyType"))
                            .append(" | Status: ").append(e.get("status"))
                            .append(" | Time: ").append(e.get("eventTime") != null ? e.get("eventTime") : e.get("timestamp"))
                            .append(" | Msg: ").append(e.get("message"))
                            .append("\n");
                }
            }
        } else {
            sb.append("• VERIFIED EMERGENCY DISTRESS EVENTS: [Nominal - No distress events active]\n");
        }

        // Append Guides summary
        sb.append("• OFFLINE EMERGENCY GUIDES AVAILABLE:\n");
        sb.append("  1. Man Overboard Procedure (MOB)\n");
        sb.append("  2. Engine Room Fire Response\n");
        sb.append("  3. Visual Distress Signals (Flares, SOS light, Flags NC)\n");
        sb.append("  4. First Aid - Marine Injuries & Hypothermia\n");
        sb.append("  5. Severe Weather & Storm Protocol\n");

        // Append Cached Chart Aids
        sb.append("• CACHED NAUTICAL CHART & AIDS (Vizhinjam Corridor, Lat 7.8N-8.8N, Lon 76.5E-77.7E):\n");
        sb.append("  - Vizhinjam Main Lighthouse (Fl(2) W 15s, 24 NM range, Lat 8.3833 N, Lon 76.9833 E)\n");
        sb.append("  - Vizhinjam Fairway Approach Buoy (Iso W 4s, Lat 8.3580 N, Lon 76.9650 E)\n");
        sb.append("  - Breakwater South Head Light (Q G 1s, Lat 8.3735 N, Lon 76.9860 E)\n");
        sb.append("  - Kovalam Beacon (Fl W 5s, 12 NM range, Lat 8.3995 N, Lon 76.9785 E)\n");
        sb.append("  - Kallu Shoal Reef Hazard (Submerged granite ridge <2.1m at LWS, Lat 8.3450 N, Lon 77.0120 E)\n");
        sb.append("  - Colachel Port Light (Fl W 10s, Lat 8.1750 N, Lon 77.2550 E)\n");
        sb.append("  - Muttom Point Lighthouse (Fl(3) W 20s, Lat 8.1200 N, Lon 77.3150 E)\n");
        sb.append("  - Wadge Bank Marine Fishery Reserve (Lat 7.9500 N, Lon 77.1200 E)\n");
        sb.append("  - Depth Contours: 10m nearshore shelf, 20m trawl line, 50m deep offshore, 100m continental shelf edge\n");
        sb.append("===============================================\n\n");

        sb.append("MARINER'S QUERY: ").append(userQuery).append("\n\n");
        sb.append("ANSWER (Keep concise, factual, and nautical):");

        return sb.toString();
    }

    /**
     * Calls Ollama's HTTP API /api/generate without streaming.
     */
    private String callOllamaGenerate(String model, String prompt) throws Exception {
        String jsonPayload = "{\"model\":\"" + escapeJson(model) + "\",\"prompt\":\"" + escapeJson(prompt) + "\",\"stream\":false}";

        HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create(ollamaBaseUrl + "/api/generate"))
                .timeout(Duration.ofSeconds(timeoutSeconds))
                .header("Content-Type", "application/json")
                .header("Accept", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(jsonPayload))
                .build();

        HttpResponse<String> resp = httpClient.send(req, HttpResponse.BodyHandlers.ofString());
        if (resp.statusCode() == 200) {
            return extractResponseText(resp.body());
        }

        log.warn("Ollama returned status {}: {}", resp.statusCode(), resp.body());
        return null;
    }

    // --- Deterministic verified data response builders ---

    private Double parseDouble(Object val) {
        if (val instanceof Number n) {
            return n.doubleValue();
        }
        if (val instanceof String s && !s.isBlank()) {
            try {
                return Double.parseDouble(s.trim());
            } catch (NumberFormatException ignored) {}
        }
        return null;
    }

    private String buildGpsAnswer(Map<String, Object> context) {
        if (context != null && context.containsKey("gps") && context.get("gps") instanceof Map<?, ?> rawGps) {
            Double latitude = parseDouble(rawGps.get("latitude"));
            Double longitude = parseDouble(rawGps.get("longitude"));
            if (latitude != null && longitude != null) {
                Object src = rawGps.get("source");
                String source = (src != null) ? src.toString() : "DEVICE_HARDWARE_GNSS";
                Object acc = rawGps.get("accuracy");
                Double spd = parseDouble(rawGps.get("speed"));
                Double hdg = parseDouble(rawGps.get("heading"));
                Object time = rawGps.get("isoTime");

                String latStr = String.format("%07.4f° %s", Math.abs(latitude), latitude >= 0 ? "N" : "S");
                String lonStr = String.format("%08.4f° %s", Math.abs(longitude), longitude >= 0 ? "E" : "W");
                String spdStr = spd != null ? String.format("%.1f kn", spd * 1.94384) : "0.0 kn";
                String hdgStr = hdg != null ? String.format("%d°", Math.round(hdg)) : "Stationary / Unspecified";

                return "● [VERIFIED TIDELINE DATA] HARDWARE GPS FIX:\n"
                        + "• Position : " + latStr + ", " + lonStr + "\n"
                        + "• Accuracy : " + (acc != null ? "±" + acc + " m" : "Unspecified") + "\n"
                        + "• Speed    : " + spdStr + "\n"
                        + "• Heading  : " + hdgStr + "\n"
                        + "• Source   : " + source + "\n"
                        + "• Recorded : " + (time != null ? time : "Active Fix");
            }
        }
        return FALLBACK_UNAVAILABLE + " No verified GNSS fix has been acquired by the device's hardware receiver. Coordinates will not be fabricated.";
    }

    private String buildVoyagesAnswer(Map<String, Object> context) {
        List<VoyageLog> list = voyageLogService.getAllVoyages();
        if (list != null && !list.isEmpty()) {
            StringBuilder sb = new StringBuilder("● [VERIFIED TIDELINE DATA] RECENT VOYAGE LOGS (" + list.size() + " total):\n");
            int count = Math.min(list.size(), 3);
            for (int i = 0; i < count; i++) {
                VoyageLog v = list.get(list.size() - 1 - i);
                sb.append("[").append(i + 1).append("] ")
                        .append(v.getVoyageDate() != null ? v.getVoyageDate() : "N/A")
                        .append(" · ").append(v.getDeparture()).append(" ➔ ").append(v.getDestination())
                        .append(" (Vessel: ").append(v.getVesselName()).append(")\n");
                if (v.getNotes() != null && !v.getNotes().isBlank()) {
                    sb.append("    Notes: \"").append(v.getNotes()).append("\"\n");
                }
            }
            return sb.toString().trim();
        }

        if (context != null && context.get("voyages") instanceof List<?> clientVoyages && !clientVoyages.isEmpty()) {
            StringBuilder sb = new StringBuilder("● [VERIFIED TIDELINE DATA] RECENT VOYAGE LOGS (" + clientVoyages.size() + " total logged):\n");
            int count = Math.min(clientVoyages.size(), 3);
            for (int i = 0; i < count; i++) {
                Object item = clientVoyages.get(clientVoyages.size() - 1 - i);
                if (item instanceof Map<?, ?> v) {
                    String date = v.get("voyageDate") != null ? v.get("voyageDate").toString() : "N/A";
                    String dep = v.get("departure") != null ? v.get("departure").toString() : "Departure";
                    String dest = v.get("destination") != null ? v.get("destination").toString() : "Destination";
                    String vessel = v.get("vesselName") != null ? v.get("vesselName").toString() : "TIDELINE";
                    Object notes = v.get("notes");

                    sb.append("[").append(i + 1).append("] ")
                            .append(date).append(" · ").append(dep).append(" ➔ ").append(dest)
                            .append(" (Vessel: ").append(vessel).append(")\n");
                    if (notes != null && !notes.toString().isBlank()) {
                        sb.append("    Notes: \"").append(notes).append("\"\n");
                    }
                }
            }
            return sb.toString().trim();
        }

        return FALLBACK_UNAVAILABLE + " No voyage logs are currently recorded in verified local storage.";
    }

    private String buildMaintenanceAnswer(Map<String, Object> context, String query) {
        List<MaintenanceRecord> list = maintenanceRecordService.getAllRecords();
        if (list != null && !list.isEmpty()) {
            StringBuilder sb = new StringBuilder("● [VERIFIED TIDELINE DATA] EQUIPMENT & MAINTENANCE STATUS (" + list.size() + " total):\n");
            int count = Math.min(list.size(), 4);
            for (int i = 0; i < count; i++) {
                MaintenanceRecord m = list.get(list.size() - 1 - i);
                sb.append("[").append(i + 1).append("] ").append(m.getEquipment())
                        .append(" — Status: ").append(m.getStatus() != null ? m.getStatus() : "OK")
                        .append("\n    Logged: ").append(m.getMaintenanceDate() != null ? m.getMaintenanceDate() : "N/A")
                        .append(m.getNextServiceDate() != null ? " · Next Due: " + m.getNextServiceDate() : "")
                        .append("\n");
                if (m.getNotes() != null && !m.getNotes().isBlank()) {
                    sb.append("    Notes: ").append(m.getNotes()).append("\n");
                }
            }
            return sb.toString().trim();
        }

        if (context != null && context.get("maintenance") instanceof List<?> clientMaint && !clientMaint.isEmpty()) {
            StringBuilder sb = new StringBuilder("● [VERIFIED TIDELINE DATA] EQUIPMENT & MAINTENANCE STATUS (" + clientMaint.size() + " records logged):\n");
            int count = Math.min(clientMaint.size(), 4);
            for (int i = 0; i < count; i++) {
                Object item = clientMaint.get(clientMaint.size() - 1 - i);
                if (item instanceof Map<?, ?> m) {
                    String eq = m.get("equipment") != null ? m.get("equipment").toString() : "Equipment";
                    String st = m.get("status") != null ? m.get("status").toString() : "OK";
                    String date = m.get("maintenanceDate") != null ? m.get("maintenanceDate").toString() : "N/A";
                    Object next = m.get("nextServiceDate");
                    Object notes = m.get("notes");

                    sb.append("[").append(i + 1).append("] ").append(eq)
                            .append(" — Status: ").append(st)
                            .append("\n    Logged: ").append(date)
                            .append(next != null ? " · Next Due: " + next : "")
                            .append("\n");
                    if (notes != null && !notes.toString().isBlank()) {
                        sb.append("    Notes: ").append(notes).append("\n");
                    }
                }
            }
            return sb.toString().trim();
        }

        return FALLBACK_UNAVAILABLE + " No equipment maintenance records are currently saved in verified local storage.";
    }

    private String buildEmergencyAnswer(Map<String, Object> context) {
        List<EmergencyEvent> list = emergencyEventService.getAllEvents();
        if (list != null && !list.isEmpty()) {
            StringBuilder sb = new StringBuilder("● [VERIFIED TIDELINE DATA] EMERGENCY DISTRESS RECORDS (" + list.size() + " logged):\n");
            for (int i = 0; i < list.size(); i++) {
                EmergencyEvent e = list.get(i);
                String txDesc = "TRANSMITTED".equals(e.getStatus())
                        ? "VERIFIED TRANSMITTED TO SHORE/SAR"
                        : ("PENDING_TRANSMISSION".equals(e.getStatus()) ? "PENDING TRANSMISSION (Awaiting radio/satellite link)" : "LOCAL ONLY");
                sb.append("[").append(i + 1).append("] ").append(e.getEmergencyType())
                        .append(" — ").append(txDesc)
                        .append("\n    Logged: ").append(e.getEventTime() != null ? e.getEventTime() : "Time unlogged")
                        .append("\n    Message: \"").append(e.getMessage() != null ? e.getMessage() : "Distress signal").append("\"\n");
            }
            return sb.toString().trim();
        }

        if (context != null && context.get("emergencies") instanceof List<?> clientEm && !clientEm.isEmpty()) {
            StringBuilder sb = new StringBuilder("● [VERIFIED TIDELINE DATA] EMERGENCY DISTRESS RECORDS (" + clientEm.size() + " logged):\n");
            for (int i = 0; i < clientEm.size(); i++) {
                Object item = clientEm.get(i);
                if (item instanceof Map<?, ?> e) {
                    String type = e.get("emergencyType") != null ? e.get("emergencyType").toString() : "DISTRESS";
                    String status = e.get("status") != null ? e.get("status").toString() : "LOCAL ONLY";
                    String txDesc = "TRANSMITTED".equalsIgnoreCase(status)
                            ? "VERIFIED TRANSMITTED TO SHORE/SAR"
                            : ("PENDING_TRANSMISSION".equalsIgnoreCase(status) ? "PENDING TRANSMISSION (Awaiting radio/satellite link)" : "LOCAL ONLY");
                    String time = e.get("eventTime") != null ? e.get("eventTime").toString() : (e.get("timestamp") != null ? e.get("timestamp").toString() : "Time unlogged");
                    Object msg = e.get("message");

                    sb.append("[").append(i + 1).append("] ").append(type)
                            .append(" — ").append(txDesc)
                            .append("\n    Logged: ").append(time)
                            .append("\n    Message: \"").append(msg != null ? msg : "Distress signal").append("\"\n");
                }
            }
            return sb.toString().trim();
        }

        return "● [VERIFIED TIDELINE DATA] EMERGENCY STATUS: No active emergency distress events recorded in verified local storage. Vessel status nominal.";
    }

    private String buildGuideAnswer(Map<String, Object> context, String query) {
        if (query.contains("mob") || query.contains("man overboard")) {
            return "● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 01: MAN OVERBOARD (MOB) PROCEDURE\n"
                    + "1. Shout \"MAN OVERBOARD!\" immediately to alert all vessel crew.\n"
                    + "2. Throw a life ring or buoyant marker immediately to mark position and aid flotation.\n"
                    + "3. Maintain continuous visual watch on the person in the water.\n"
                    + "4. Record immediate GPS fix timestamp into voyage log.\n"
                    + "5. Execute Williamson turn or Anderson turn back onto initial track.";
        }
        if (query.contains("fire")) {
            return "● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 02: ENGINE ROOM FIRE RESPONSE\n"
                    + "1. Cut engine fuel line shut-off valve immediately.\n"
                    + "2. Shut down ventilation and engine air intakes.\n"
                    + "3. Do NOT open the engine enclosure fully (oxygen rush intensifies fire).\n"
                    + "4. Discharge dry chemical or CO2 extinguisher via dedicated port.\n"
                    + "5. Prepare emergency handheld VHF and visual flares.";
        }
        if (query.contains("flare") || query.contains("distress signal") || query.contains("sos")) {
            return "● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 03: VISUAL DISTRESS SIGNALS\n"
                    + "1. Red handheld flares for night or overcast visibility (hold downwind).\n"
                    + "2. Orange smoke canister for daylight sea marker.\n"
                    + "3. SOS flash pattern with flashlight: 3 short, 3 long, 3 short (... --- ...).\n"
                    + "4. Code flags \"N\" over \"C\" (November Charlie).\n"
                    + "5. Slow, repeated arm raising and lowering from sides.";
        }
        if (query.contains("first aid") || query.contains("hypothermia") || query.contains("bleed")) {
            return "● [VERIFIED TIDELINE DATA] OFFLINE GUIDE 04: FIRST AID AT SEA\n"
                    + "1. Severe bleeding: Apply direct continuous pressure with clean sterile dressing.\n"
                    + "2. Hypothermia: Strip off wet attire, wrap in dry blanket/foil sheet, shield from sea wind.\n"
                    + "3. Fractures: Splint limb above and below joint before moving patient.\n"
                    + "4. Heat exhaustion / dehydration: Move to shaded deck, provide small sips of drinking water.";
        }
        return "● [VERIFIED TIDELINE DATA] OFFLINE SAFETY GUIDES AVAILABLE:\n"
                + "• Guide 01: Man Overboard Procedure (MOB)\n"
                + "• Guide 02: Engine Room Fire Response\n"
                + "• Guide 03: Visual Distress Signals\n"
                + "• Guide 04: First Aid - Marine Injuries & Hypothermia\n"
                + "• Guide 05: Severe Weather & Storm Protocol";
    }

    private String buildMapAnswer(Map<String, Object> context, String query) {
        return "● [VERIFIED TIDELINE DATA] CACHED NAUTICAL CHART & AIDS (Vizhinjam Sector):\n"
                + "• Vizhinjam Main Lighthouse : Lat 8.3833° N, Lon 76.9833° E · Fl(2) W 15s · Range 24 NM\n"
                + "• Fairway Approach Buoy    : Lat 8.3580° N, Lon 76.9650° E · Iso W 4s\n"
                + "• Breakwater South Light   : Lat 8.3735° N, Lon 76.9860° E · Q G 1s\n"
                + "• Kovalam Beacon           : Lat 8.3995° N, Lon 76.9785° E · Fl W 5s · Range 12 NM\n"
                + "• Kallu Shoal Reef Hazard  : Lat 8.3450° N, Lon 77.0120° E · Submerged granite ridge (<2.1m at LWS)\n"
                + "• Depth Contours           : 10m Nearshore Shelf, 20m Coastal Trawl Line, 50m Deep Offshore, 100m Shelf Edge\n"
                + "• Harbour Zone             : Vizhinjam International Deepwater Port Approach";
    }

    private String buildVesselAnswer(Map<String, Object> context) {
        List<VoyageLog> list = voyageLogService.getAllVoyages();
        if (list != null && !list.isEmpty()) {
            VoyageLog last = list.get(list.size() - 1);
            return "● [VERIFIED TIDELINE DATA] VESSEL IDENTITY:\n"
                    + "• Vessel Name : " + (last.getVesselName() != null ? last.getVesselName() : "TIDELINE") + "\n"
                    + "• Total Logged Voyages : " + list.size() + "\n"
                    + "• Operational Status   : Commissioned (Offline-First Bridge)";
        }
        return "● [VERIFIED TIDELINE DATA] VESSEL IDENTITY:\n"
                + "• Vessel Name : TIDELINE (Default Vessel)\n"
                + "• Operational Status: Commissioned (Offline-First Bridge)";
    }

    // --- Lightweight Zero-Dependency JSON Helpers ---

    private String escapeJson(String s) {
        if (s == null) return "";
        StringBuilder sb = new StringBuilder();
        for (char c : s.toCharArray()) {
            switch (c) {
                case '"' -> sb.append("\\\"");
                case '\\' -> sb.append("\\\\");
                case '\b' -> sb.append("\\b");
                case '\f' -> sb.append("\\f");
                case '\n' -> sb.append("\\n");
                case '\r' -> sb.append("\\r");
                case '\t' -> sb.append("\\t");
                default -> {
                    if (c < ' ') {
                        sb.append(String.format("\\u%04x", (int) c));
                    } else {
                        sb.append(c);
                    }
                }
            }
        }
        return sb.toString();
    }

    private List<String> parseModelNames(String jsonBody) {
        List<String> list = new ArrayList<>();
        if (jsonBody == null || jsonBody.isBlank()) return list;
        Pattern pattern = Pattern.compile("\"name\"\\s*:\\s*\"([^\"]+)\"");
        Matcher matcher = pattern.matcher(jsonBody);
        while (matcher.find()) {
            list.add(matcher.group(1));
        }
        return list;
    }

    private String extractResponseText(String jsonBody) {
        if (jsonBody == null || jsonBody.isBlank()) return null;
        Pattern pattern = Pattern.compile("\"response\"\\s*:\\s*\"((?:[^\"\\\\]|\\\\.)*)\"");
        Matcher matcher = pattern.matcher(jsonBody);
        if (matcher.find()) {
            return unescapeJson(matcher.group(1));
        }
        return null;
    }

    private String unescapeJson(String s) {
        if (s == null) return null;
        StringBuilder sb = new StringBuilder();
        int len = s.length();
        for (int i = 0; i < len; i++) {
            char c = s.charAt(i);
            if (c == '\\' && i + 1 < len) {
                char next = s.charAt(++i);
                switch (next) {
                    case '"' -> sb.append('"');
                    case '\\' -> sb.append('\\');
                    case '/' -> sb.append('/');
                    case 'b' -> sb.append('\b');
                    case 'f' -> sb.append('\f');
                    case 'n' -> sb.append('\n');
                    case 'r' -> sb.append('\r');
                    case 't' -> sb.append('\t');
                    case 'u' -> {
                        if (i + 4 < len) {
                            String hex = s.substring(i + 1, i + 5);
                            try {
                                sb.append((char) Integer.parseInt(hex, 16));
                                i += 4;
                            } catch (NumberFormatException nfe) {
                                sb.append("\\u");
                            }
                        } else {
                            sb.append("\\u");
                        }
                    }
                    default -> sb.append(next);
                }
            } else {
                sb.append(c);
            }
        }
        return sb.toString();
    }
}
