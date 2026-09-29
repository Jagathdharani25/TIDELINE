package com.tideline.backend;

import java.util.List;
import java.util.Map;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.tideline.backend.controller.AssistantController;
import com.tideline.backend.model.AssistantRequest;
import com.tideline.backend.model.AssistantResponse;
import com.tideline.backend.model.AssistantStatusResponse;
import com.tideline.backend.model.EmergencyEvent;
import com.tideline.backend.model.MaintenanceRecord;
import com.tideline.backend.model.VoyageLog;
import com.tideline.backend.service.AssistantService;
import com.tideline.backend.service.EmergencyEventService;
import com.tideline.backend.service.MaintenanceRecordService;
import com.tideline.backend.service.VoyageLogService;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AssistantControllerTest {

    @Test
    void getStatusReturnsOnlineWhenOllamaRunning() throws Exception {
        AssistantService mockService = Mockito.mock(AssistantService.class);
        AssistantStatusResponse mockStatus = new AssistantStatusResponse(
                "ONLINE",
                "Ollama",
                "http://localhost:11434",
                "llama3.2:1b",
                List.of("llama3.2:1b", "phi3:mini"),
                "Connected"
        );
        Mockito.when(mockService.getStatus()).thenReturn(mockStatus);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AssistantController(mockService)).build();

        mockMvc.perform(get("/api/assistant/status").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ONLINE"))
                .andExpect(jsonPath("$.runtime").value("Ollama"))
                .andExpect(jsonPath("$.endpoint").value("http://localhost:11434"))
                .andExpect(jsonPath("$.model").value("llama3.2:1b"))
                .andExpect(jsonPath("$.availableModels[0]").value("llama3.2:1b"));
    }

    @Test
    void getStatusReturnsUnavailableWhenOllamaOffline() throws Exception {
        AssistantService mockService = Mockito.mock(AssistantService.class);
        AssistantStatusResponse mockStatus = new AssistantStatusResponse(
                "UNAVAILABLE",
                "Ollama",
                "http://localhost:11434",
                "llama3.2:1b",
                List.of(),
                "Local LLM runtime is unavailable"
        );
        Mockito.when(mockService.getStatus()).thenReturn(mockStatus);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AssistantController(mockService)).build();

        mockMvc.perform(get("/api/assistant/status").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("UNAVAILABLE"))
                .andExpect(jsonPath("$.availableModels").isEmpty());
    }

    @Test
    void chatReturnsGroundedAnswer() throws Exception {
        AssistantService mockService = Mockito.mock(AssistantService.class);
        AssistantResponse mockResponse = new AssistantResponse(
                true,
                "● [VERIFIED TIDELINE DATA] HARDWARE GPS FIX:\n• Position: 08.3758° N, 076.9900° E",
                "LOCAL_LLM (Grounded in Verified Data)",
                "llama3.2:1b",
                "ONLINE",
                true,
                "VERIFIED_GPS",
                "Success"
        );
        Mockito.when(mockService.processQuery(any())).thenReturn(mockResponse);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AssistantController(mockService)).build();

        String payload = """
            {
                "query": "What is our GPS fix?",
                "context": {
                    "gps": {
                        "latitude": 8.3758,
                        "longitude": 76.99
                    }
                },
                "model": "llama3.2:1b"
            }
            """;

        mockMvc.perform(post("/api/assistant/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.grounded").value(true))
                .andExpect(jsonPath("$.verifiedSource").value("VERIFIED_GPS"))
                .andExpect(jsonPath("$.answer").value(org.hamcrest.Matchers.containsString("08.3758° N")));
    }

    @Test
    void chatHandlesModelUnavailableGracefully() throws Exception {
        AssistantService mockService = Mockito.mock(AssistantService.class);
        AssistantResponse mockResponse = new AssistantResponse(
                false,
                "Local LLM runtime (Ollama) is currently unavailable",
                "MODEL_UNAVAILABLE",
                "llama3.2:1b",
                "MODEL_UNAVAILABLE",
                false,
                null,
                "Ollama is not running"
        );
        Mockito.when(mockService.processQuery(any())).thenReturn(mockResponse);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AssistantController(mockService)).build();

        String payload = """
            {
                "query": "Explain celestial navigation",
                "model": "llama3.2:1b"
            }
            """;

        mockMvc.perform(post("/api/assistant/chat")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.status").value("MODEL_UNAVAILABLE"));
    }

    @Test
    void assistantServiceEnforcesWeatherSafetyPolicy() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        AssistantService service = new AssistantService(
                "http://localhost:11434",
                "llama3.2:1b",
                5,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        AssistantRequest req = new AssistantRequest("What is tomorrow's weather and wave height forecast?", Map.of(), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.getAnswer().contains("Verified data is unavailable"));
        assertTrue(resp.getAnswer().contains("does not fabricate weather forecasts"));
    }

    @Test
    void assistantServiceDeterministicGpsFallback() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        AssistantService service = new AssistantService(
                "http://localhost:9999", // dead port -> offline
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        Map<String, Object> gpsData = Map.of(
                "latitude", 8.3758,
                "longitude", 76.9900,
                "accuracy", 4.2,
                "speed", 3.5,
                "heading", 185.0,
                "source", "DEVICE_HARDWARE_GNSS"
        );

        AssistantRequest req = new AssistantRequest("What is our current GPS location?", Map.of("gps", gpsData), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertEquals("VERIFIED_GPS", resp.getVerifiedSource());
        assertTrue(resp.getAnswer().contains("08.3758"));
        assertTrue(resp.getAnswer().contains("076.9900"));
    }

    @Test
    void assistantServiceDeterministicVoyageFallback() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        VoyageLog sample = new VoyageLog(1L, "2026-09-20", "Vizhinjam", "Arabian Sea Sector 4", "TIDELINE-01", "Calm swell", "2026-09-20T06:00:00Z");
        Mockito.when(mockVoyage.getAllVoyages()).thenReturn(List.of(sample));

        AssistantService service = new AssistantService(
                "http://localhost:9999",
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        AssistantRequest req = new AssistantRequest("What were our recent voyages?", Map.of(), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertEquals("VERIFIED_VOYAGE_DB", resp.getVerifiedSource());
        assertTrue(resp.getAnswer().contains("Vizhinjam"));
        assertTrue(resp.getAnswer().contains("Arabian Sea Sector 4"));
    }

    @Test
    void assistantServiceDeterministicGuideFallback() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        AssistantService service = new AssistantService(
                "http://localhost:9999",
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        AssistantRequest req = new AssistantRequest("What is the Man Overboard MOB procedure?", Map.of(), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertEquals("OFFLINE_GUIDES", resp.getVerifiedSource());
        assertTrue(resp.getAnswer().contains("MAN OVERBOARD"));
        assertTrue(resp.getAnswer().contains("Williamson turn"));
    }

    @Test
    void getInfoReturnsAssistantMetadata() throws Exception {
        AssistantService mockService = Mockito.mock(AssistantService.class);
        AssistantStatusResponse mockStatus = new AssistantStatusResponse(
                "ONLINE",
                "Ollama",
                "http://localhost:11434",
                "llama3.2:1b",
                List.of("llama3.2:1b"),
                "Connected"
        );
        Mockito.when(mockService.getStatus()).thenReturn(mockStatus);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AssistantController(mockService)).build();

        mockMvc.perform(get("/api/assistant").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.name").value("TIDELINE Local Marine AI Assistant"))
                .andExpect(jsonPath("$.version").value("2.0.0"))
                .andExpect(jsonPath("$.mode").value("OFFLINE_FIRST"))
                .andExpect(jsonPath("$.status").value("ONLINE"))
                .andExpect(jsonPath("$.defaultModel").value("llama3.2:1b"));
    }

    @Test
    void getModelsReturnsList() throws Exception {
        AssistantService mockService = Mockito.mock(AssistantService.class);
        Mockito.when(mockService.getAvailableModels()).thenReturn(List.of("llama3.2:1b", "phi3:mini"));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AssistantController(mockService)).build();

        mockMvc.perform(get("/api/assistant/models").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0]").value("llama3.2:1b"))
                .andExpect(jsonPath("$[1]").value("phi3:mini"));
    }

    @Test
    void assistantServiceDeterministicMaintenanceFallback() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        MaintenanceRecord record = new MaintenanceRecord(1L, "TIDELINE", "Bilge Pump B", "2026-09-18", "2026-10-18", "OPERATIONAL", "Impeller checked", "2026-09-18T10:00:00Z");
        Mockito.when(mockMaint.getAllRecords()).thenReturn(List.of(record));

        AssistantService service = new AssistantService(
                "http://localhost:9999",
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        AssistantRequest req = new AssistantRequest("What is our equipment maintenance status?", Map.of(), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertEquals("VERIFIED_MAINTENANCE_DB", resp.getVerifiedSource());
        assertTrue(resp.getAnswer().contains("Bilge Pump B"));
        assertTrue(resp.getAnswer().contains("OPERATIONAL"));
    }

    @Test
    void assistantServiceDeterministicEmergencyFallback() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        EmergencyEvent event = new EmergencyEvent(1L, "ENGINE_FIRE", 8.3758, 76.9900, "2026-09-22T10:15:00Z", "Engine room fire controlled", "TRANSMITTED", "2026-09-22T10:15:00Z");
        Mockito.when(mockEmergency.getAllEvents()).thenReturn(List.of(event));

        AssistantService service = new AssistantService(
                "http://localhost:9999",
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        AssistantRequest req = new AssistantRequest("Are there any emergency distress records?", Map.of(), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertEquals("VERIFIED_EMERGENCY_DB", resp.getVerifiedSource());
        assertTrue(resp.getAnswer().contains("ENGINE_FIRE"));
        assertTrue(resp.getAnswer().contains("VERIFIED TRANSMITTED"));
    }

    @Test
    void assistantServiceContextVoyageFallback() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        Mockito.when(mockVoyage.getAllVoyages()).thenReturn(List.of()); // DB empty

        AssistantService service = new AssistantService(
                "http://localhost:9999",
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        Map<String, Object> clientVoyage = Map.of(
                "voyageDate", "2026-09-28",
                "departure", "Kovalam Anchorage",
                "destination", "Vizhinjam Terminal",
                "vesselName", "TIDELINE",
                "notes", "Night transit safely completed"
        );

        AssistantRequest req = new AssistantRequest("What was our recent route and voyage?", Map.of("voyages", List.of(clientVoyage)), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertTrue(resp.getAnswer().contains("Kovalam Anchorage"));
        assertTrue(resp.getAnswer().contains("Vizhinjam Terminal"));
    }

    @Test
    void assistantServiceGpsStringParsingSupport() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        AssistantService service = new AssistantService(
                "http://localhost:9999",
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        Map<String, Object> stringGps = Map.of(
                "latitude", "8.3758",
                "longitude", "76.9900",
                "accuracy", "5",
                "speed", "2.1",
                "heading", "90"
        );

        AssistantRequest req = new AssistantRequest("What is our current coordinates?", Map.of("gps", stringGps), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertTrue(resp.getAnswer().contains("08.3758° N"));
        assertTrue(resp.getAnswer().contains("076.9900° E"));
    }

    @Test
    void assistantServiceDeterministicChartAidsFallback() {
        VoyageLogService mockVoyage = Mockito.mock(VoyageLogService.class);
        MaintenanceRecordService mockMaint = Mockito.mock(MaintenanceRecordService.class);
        EmergencyEventService mockEmergency = Mockito.mock(EmergencyEventService.class);

        AssistantService service = new AssistantService(
                "http://localhost:9999",
                "llama3.2:1b",
                1,
                mockVoyage,
                mockMaint,
                mockEmergency
        );

        AssistantRequest req = new AssistantRequest("What lighthouses and nautical chart aids are near Vizhinjam?", Map.of(), "llama3.2:1b");
        AssistantResponse resp = service.processQuery(req);

        assertNotNull(resp);
        assertTrue(resp.isSuccess());
        assertTrue(resp.isGrounded());
        assertEquals("CACHED_CHARTS", resp.getVerifiedSource());
        assertTrue(resp.getAnswer().contains("Vizhinjam Main Lighthouse"));
        assertTrue(resp.getAnswer().contains("Kallu Shoal Reef Hazard"));
    }
}
