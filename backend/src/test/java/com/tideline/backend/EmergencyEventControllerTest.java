package com.tideline.backend;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.tideline.backend.controller.EmergencyEventController;
import com.tideline.backend.model.EmergencyEvent;
import com.tideline.backend.service.EmergencyEventService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class EmergencyEventControllerTest {

    @Test
    void getAllEventsReturnsList() throws Exception {
        EmergencyEventService mockService = Mockito.mock(EmergencyEventService.class);
        EmergencyEvent sample = new EmergencyEvent(1L, "DISTRESS_SOS", 8.0758, 77.0142, "2026-09-18T12:00:00Z", "Man overboard offshore", "PENDING_TRANSMISSION", "2026-09-18T12:00:00Z");
        Mockito.when(mockService.getAllEvents()).thenReturn(List.of(sample));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new EmergencyEventController(mockService)).build();

        mockMvc.perform(get("/api/emergencies").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].emergencyType").value("DISTRESS_SOS"))
                .andExpect(jsonPath("$[0].latitude").value(8.0758))
                .andExpect(jsonPath("$[0].longitude").value(77.0142))
                .andExpect(jsonPath("$[0].status").value("PENDING_TRANSMISSION"));
    }

    @Test
    void getEventByIdReturnsFound() throws Exception {
        EmergencyEventService mockService = Mockito.mock(EmergencyEventService.class);
        EmergencyEvent sample = new EmergencyEvent(2L, "ENGINE_FIRE", 8.0210, 77.0550, "2026-09-18T12:15:00Z", "Fire in compartment B", "LOCAL_ONLY", "2026-09-18T12:15:00Z");
        Mockito.when(mockService.getEventById(2L)).thenReturn(Optional.of(sample));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new EmergencyEventController(mockService)).build();

        mockMvc.perform(get("/api/emergencies/2").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.emergencyType").value("ENGINE_FIRE"))
                .andExpect(jsonPath("$.status").value("LOCAL_ONLY"));
    }

    @Test
    void getEventByIdReturns404WhenNotFound() throws Exception {
        EmergencyEventService mockService = Mockito.mock(EmergencyEventService.class);
        Mockito.when(mockService.getEventById(999L)).thenReturn(Optional.empty());

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new EmergencyEventController(mockService)).build();

        mockMvc.perform(get("/api/emergencies/999").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void createEventReturnsCreated() throws Exception {
        EmergencyEventService mockService = Mockito.mock(EmergencyEventService.class);
        EmergencyEvent saved = new EmergencyEvent(5L, "DISTRESS_SOS", 8.0758, 77.0142, "2026-09-18T12:20:00Z", "Distress beacon activated", "PENDING_TRANSMISSION", "2026-09-18T12:20:00Z");
        Mockito.when(mockService.createEvent(any(EmergencyEvent.class))).thenReturn(saved);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new EmergencyEventController(mockService)).build();

        String payload = """
            {
                "emergencyType": "DISTRESS_SOS",
                "latitude": 8.0758,
                "longitude": 77.0142,
                "eventTime": "2026-09-18T12:20:00Z",
                "message": "Distress beacon activated",
                "status": "PENDING_TRANSMISSION"
            }
        """;

        mockMvc.perform(post("/api/emergencies")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(5))
                .andExpect(jsonPath("$.emergencyType").value("DISTRESS_SOS"))
                .andExpect(jsonPath("$.status").value("PENDING_TRANSMISSION"));
    }

    @Test
    void deleteEventReturnsNoContent() throws Exception {
        EmergencyEventService mockService = Mockito.mock(EmergencyEventService.class);
        Mockito.when(mockService.deleteEvent(5L)).thenReturn(true);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new EmergencyEventController(mockService)).build();

        mockMvc.perform(delete("/api/emergencies/5"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteEventReturns404WhenNotFound() throws Exception {
        EmergencyEventService mockService = Mockito.mock(EmergencyEventService.class);
        Mockito.when(mockService.deleteEvent(eq(404L))).thenReturn(false);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new EmergencyEventController(mockService)).build();

        mockMvc.perform(delete("/api/emergencies/404"))
                .andExpect(status().isNotFound());
    }
}
