package com.tideline.backend;

import com.tideline.backend.controller.DatabaseController;
import com.tideline.backend.service.DatabaseService;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class DatabaseControllerTest {

    @Test
    void databaseStatusReturnsConnected() throws Exception {
        // Arrange: mock DatabaseService to return a CONNECTED status
        DatabaseService mockService = Mockito.mock(DatabaseService.class);

        Map<String, Object> fakeStatus = new LinkedHashMap<>();
        fakeStatus.put("database", "SQLite");
        fakeStatus.put("location", "/fake/path/data/tideline.db");
        fakeStatus.put("status", "CONNECTED");
        fakeStatus.put("engine", "SQLite");
        fakeStatus.put("version", "3.46.1");
        fakeStatus.put("fileExists", true);
        fakeStatus.put("connectionOk", true);

        Mockito.when(mockService.getStatus()).thenReturn(fakeStatus);

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new DatabaseController(mockService))
                .build();

        // Act & Assert
        mockMvc.perform(get("/api/database/status").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.database").value("SQLite"))
                .andExpect(jsonPath("$.status").value("CONNECTED"))
                .andExpect(jsonPath("$.connectionOk").value(true));
    }

    @Test
    void databaseStatusReturns503WhenError() throws Exception {
        // Arrange: mock DatabaseService to return an ERROR status
        DatabaseService mockService = Mockito.mock(DatabaseService.class);

        Map<String, Object> fakeStatus = new LinkedHashMap<>();
        fakeStatus.put("database", "SQLite");
        fakeStatus.put("status", "ERROR");
        fakeStatus.put("connectionOk", false);
        fakeStatus.put("error", "unable to open database file");

        Mockito.when(mockService.getStatus()).thenReturn(fakeStatus);

        MockMvc mockMvc = MockMvcBuilders
                .standaloneSetup(new DatabaseController(mockService))
                .build();

        // Act & Assert
        mockMvc.perform(get("/api/database/status").accept(MediaType.APPLICATION_JSON))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.status").value("ERROR"))
                .andExpect(jsonPath("$.connectionOk").value(false));
    }
}
