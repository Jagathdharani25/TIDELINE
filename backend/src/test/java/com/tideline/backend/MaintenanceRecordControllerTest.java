package com.tideline.backend;

import java.util.Collections;
import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.tideline.backend.controller.MaintenanceRecordController;
import com.tideline.backend.model.MaintenanceRecord;
import com.tideline.backend.service.MaintenanceRecordService;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class MaintenanceRecordControllerTest {

    @Test
    void getAllRecordsReturnsList() throws Exception {
        MaintenanceRecordService mockService = Mockito.mock(MaintenanceRecordService.class);
        MaintenanceRecord sample = new MaintenanceRecord(1L, "TIDELINE-01", "Main Engine Oil", "2026-09-18", "2026-10-18", "OK", "Oil replaced", "2026-09-18T05:00:00Z");
        Mockito.when(mockService.getAllRecords()).thenReturn(List.of(sample));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceRecordController(mockService)).build();

        mockMvc.perform(get("/api/maintenance").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].id").value(1))
                .andExpect(jsonPath("$[0].vesselName").value("TIDELINE-01"))
                .andExpect(jsonPath("$[0].equipment").value("Main Engine Oil"))
                .andExpect(jsonPath("$[0].status").value("OK"));
    }

    @Test
    void getRecordByIdReturnsFound() throws Exception {
        MaintenanceRecordService mockService = Mockito.mock(MaintenanceRecordService.class);
        MaintenanceRecord sample = new MaintenanceRecord(2L, "TIDELINE-01", "Bilge Pump", "2026-09-15", "2026-10-15", "DUE SOON", "Impeller inspection", "2026-09-15T08:00:00Z");
        Mockito.when(mockService.getRecordById(2L)).thenReturn(Optional.of(sample));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceRecordController(mockService)).build();

        mockMvc.perform(get("/api/maintenance/2").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(2))
                .andExpect(jsonPath("$.equipment").value("Bilge Pump"))
                .andExpect(jsonPath("$.status").value("DUE SOON"));
    }

    @Test
    void getRecordByIdReturns404WhenNotFound() throws Exception {
        MaintenanceRecordService mockService = Mockito.mock(MaintenanceRecordService.class);
        Mockito.when(mockService.getRecordById(99L)).thenReturn(Optional.empty());

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceRecordController(mockService)).build();

        mockMvc.perform(get("/api/maintenance/99").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isNotFound());
    }

    @Test
    void createRecordReturnsCreated() throws Exception {
        MaintenanceRecordService mockService = Mockito.mock(MaintenanceRecordService.class);
        MaintenanceRecord saved = new MaintenanceRecord(10L, "TIDELINE-01", "Hull Inspection", "2026-09-18", "2026-12-18", "OK", "No barnacles", "2026-09-18T10:00:00Z");
        Mockito.when(mockService.createRecord(any(MaintenanceRecord.class))).thenReturn(saved);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceRecordController(mockService)).build();

        String payload = """
            {
                "vesselName": "TIDELINE-01",
                "equipment": "Hull Inspection",
                "maintenanceDate": "2026-09-18",
                "nextServiceDate": "2026-12-18",
                "status": "OK",
                "notes": "No barnacles"
            }
        """;

        mockMvc.perform(post("/api/maintenance")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(payload)
                        .accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(10))
                .andExpect(jsonPath("$.equipment").value("Hull Inspection"))
                .andExpect(jsonPath("$.status").value("OK"));
    }

    @Test
    void deleteRecordReturnsNoContent() throws Exception {
        MaintenanceRecordService mockService = Mockito.mock(MaintenanceRecordService.class);
        Mockito.when(mockService.deleteRecord(5L)).thenReturn(true);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceRecordController(mockService)).build();

        mockMvc.perform(delete("/api/maintenance/5"))
                .andExpect(status().isNoContent());
    }

    @Test
    void deleteRecordReturns404WhenNotFound() throws Exception {
        MaintenanceRecordService mockService = Mockito.mock(MaintenanceRecordService.class);
        Mockito.when(mockService.deleteRecord(eq(404L))).thenReturn(false);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new MaintenanceRecordController(mockService)).build();

        mockMvc.perform(delete("/api/maintenance/404"))
                .andExpect(status().isNotFound());
    }
}
