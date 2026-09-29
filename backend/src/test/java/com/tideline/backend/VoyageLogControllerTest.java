package com.tideline.backend;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.tideline.backend.controller.VoyageLogController;
import com.tideline.backend.model.VoyageLog;
import com.tideline.backend.service.VoyageLogService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class VoyageLogControllerTest {

    @Test
    void getAllVoyagesReturnsList() throws Exception {
        VoyageLogService mockService = Mockito.mock(VoyageLogService.class);
        VoyageLog sample = new VoyageLog(1L, "2026-09-18", "Vizhinjam", "Arabian Sea", "TIDELINE-01", "Calm swell", "2026-09-18T05:00:00Z");
        Mockito.when(mockService.getAllVoyages()).thenReturn(List.of(sample));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new VoyageLogController(mockService)).build();

        mockMvc.perform(get("/api/voyages").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].vesselName").value("TIDELINE-01"))
                .andExpect(jsonPath("$[0].departure").value("Vizhinjam"))
                .andExpect(jsonPath("$[0].destination").value("Arabian Sea"));
    }

    @Test
    void getVoyageByIdReturnsFound() throws Exception {
        VoyageLogService mockService = Mockito.mock(VoyageLogService.class);
        VoyageLog sample = new VoyageLog(2L, "2026-09-18", "Cochin", "Lakshadweep", "SEA-BREEZE", "Engine check ok", "2026-09-18T08:00:00Z");
        Mockito.when(mockService.getVoyageById(2L)).thenReturn(Optional.of(sample));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new VoyageLogController(mockService)).build();

        mockMvc.perform(get("/api/voyages/2").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.vesselName").value("SEA-BREEZE"));
    }

    @Test
    void getVoyageByIdReturns404WhenNotFound() throws Exception {
        VoyageLogService mockService = Mockito.mock(VoyageLogService.class);
        Mockito.when(mockService.getVoyageById(99L)).thenReturn(Optional.empty());

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new VoyageLogController(mockService)).build();

        mockMvc.perform(get("/api/voyages/99").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void createVoyageReturns201Created() throws Exception {
        VoyageLogService mockService = Mockito.mock(VoyageLogService.class);
        VoyageLog created = new VoyageLog(10L, "2026-09-18", "Vizhinjam", "Sector 4", "TIDELINE-01", "Traps set", "2026-09-18T10:00:00Z");
        Mockito.when(mockService.createVoyage(any(VoyageLog.class))).thenReturn(created);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new VoyageLogController(mockService)).build();

        String payload = """
            {
                "voyageDate": "2026-09-18",
                "departure": "Vizhinjam",
                "destination": "Sector 4",
                "vesselName": "TIDELINE-01",
                "notes": "Traps set"
            }
        """;

        mockMvc.perform(post("/api/voyages")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.notes").value("Traps set"));
    }

    @Test
    void deleteVoyageReturns204WhenDeleted() throws Exception {
        VoyageLogService mockService = Mockito.mock(VoyageLogService.class);
        Mockito.when(mockService.deleteVoyage(10L)).thenReturn(true);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new VoyageLogController(mockService)).build();

        mockMvc.perform(delete("/api/voyages/10"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteVoyageReturns404WhenNotFound() throws Exception {
        VoyageLogService mockService = Mockito.mock(VoyageLogService.class);
        Mockito.when(mockService.deleteVoyage(99L)).thenReturn(false);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new VoyageLogController(mockService)).build();

        mockMvc.perform(delete("/api/voyages/99"))
                .andExpect(status().isNotFound());
    }
}
