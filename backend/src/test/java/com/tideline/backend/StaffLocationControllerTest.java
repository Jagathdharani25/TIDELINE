package com.tideline.backend;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.tideline.backend.controller.StaffLocationController;
import com.tideline.backend.model.StaffLocation;
import com.tideline.backend.model.StaffLocationRequest;
import com.tideline.backend.model.StaffUser;
import com.tideline.backend.service.AuthService;
import com.tideline.backend.service.StaffLocationService;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class StaffLocationControllerTest {

    @Test
    void shareLocationRequiresAuthentication() throws Exception {
        StaffLocationService locationService = Mockito.mock(StaffLocationService.class);
        AuthService authService = Mockito.mock(AuthService.class);

        Mockito.when(authService.validateToken(any())).thenReturn(Optional.empty());

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new StaffLocationController(locationService, authService)).build();

        mockMvc.perform(post("/api/locations/share")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\":8.38,\"longitude\":76.98}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void shareLocationSucceedsForAuthenticatedStaff() throws Exception {
        StaffLocationService locationService = Mockito.mock(StaffLocationService.class);
        AuthService authService = Mockito.mock(AuthService.class);

        StaffUser staff = new StaffUser(1L, "officer_vizhinjam", "Lt. Arun Nair", "hash", "OFFICER", "Nav Officer", "2026-10-16T10:00:00Z", null);
        StaffLocation loc = new StaffLocation(10L, 1L, "officer_vizhinjam", "Lt. Arun Nair", "OFFICER", 8.3758, 76.9900, 4.2, 8.5, 210.0, "2026-10-16T12:00:00Z", "TIDELINE-01", "Patrolling fairway");
        loc.setFreshness("ACTIVE");

        Mockito.when(authService.validateToken("Bearer test-token")).thenReturn(Optional.of(staff));
        Mockito.when(locationService.recordLocation(any(StaffUser.class), any(StaffLocationRequest.class))).thenReturn(loc);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new StaffLocationController(locationService, authService)).build();

        mockMvc.perform(post("/api/locations/share")
                        .header("Authorization", "Bearer test-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"latitude\":8.3758,\"longitude\":76.9900,\"accuracy\":4.2,\"speed\":8.5,\"heading\":210.0,\"vesselName\":\"TIDELINE-01\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.location.username").value("officer_vizhinjam"))
                .andExpect(jsonPath("$.location.latitude").value(8.3758))
                .andExpect(jsonPath("$.location.freshness").value("ACTIVE"))
                .andExpect(jsonPath("$.communicationNotice").exists());
    }

    @Test
    void getStaffLocationsRequiresAuthentication() throws Exception {
        StaffLocationService locationService = Mockito.mock(StaffLocationService.class);
        AuthService authService = Mockito.mock(AuthService.class);

        Mockito.when(authService.validateToken(any())).thenReturn(Optional.empty());

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new StaffLocationController(locationService, authService)).build();

        mockMvc.perform(get("/api/locations"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getStaffLocationsReturnsListForAuthenticatedUser() throws Exception {
        StaffLocationService locationService = Mockito.mock(StaffLocationService.class);
        AuthService authService = Mockito.mock(AuthService.class);

        StaffUser staff = new StaffUser(1L, "admin", "Commander Sharma", "hash", "ADMIN", "Administrator", "2026-10-16T10:00:00Z", null);
        StaffLocation loc1 = new StaffLocation(1L, 2L, "officer_vizhinjam", "Lt. Arun Nair", "OFFICER", 8.3758, 76.9900, 5.0, 10.0, 180.0, "2026-10-16T12:00:00Z", "TIDELINE-01", "Active");
        loc1.setFreshness("ACTIVE");

        Mockito.when(authService.validateToken("Bearer test-token")).thenReturn(Optional.of(staff));
        Mockito.when(locationService.getLatestLocations()).thenReturn(List.of(loc1));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new StaffLocationController(locationService, authService)).build();

        mockMvc.perform(get("/api/locations")
                        .header("Authorization", "Bearer test-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.count").value(1))
                .andExpect(jsonPath("$.locations[0].username").value("officer_vizhinjam"))
                .andExpect(jsonPath("$.locations[0].freshness").value("ACTIVE"));
    }
}
