package com.tideline.backend;

import java.util.List;
import java.util.Optional;

import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;

import com.tideline.backend.controller.AuthController;
import com.tideline.backend.model.LoginRequest;
import com.tideline.backend.model.LoginResponse;
import com.tideline.backend.model.StaffRegisterRequest;
import com.tideline.backend.model.StaffUser;
import com.tideline.backend.model.StaffUserDto;
import com.tideline.backend.service.AuthService;

import static org.mockito.ArgumentMatchers.any;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AuthControllerTest {

    @Test
    void loginWithValidCredentialsReturnsTokenAndUser() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        StaffUserDto userDto = new StaffUserDto(1L, "officer_vizhinjam", "Lt. Arun Nair", "OFFICER", "Navigation Officer", "2026-10-16T12:00:00Z", "2026-10-16T12:00:00Z");
        LoginResponse response = LoginResponse.success("fake-token-12345", userDto, "2026-10-17T12:00:00Z");

        Mockito.when(authService.login(any(LoginRequest.class))).thenReturn(response);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"officer_vizhinjam\",\"password\":\"OfficerPass2026!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").value("fake-token-12345"))
                .andExpect(jsonPath("$.user.username").value("officer_vizhinjam"))
                .andExpect(jsonPath("$.user.role").value("OFFICER"));
    }

    @Test
    void loginWithInvalidCredentialsReturns401() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        LoginResponse response = LoginResponse.error("Invalid username or password");

        Mockito.when(authService.login(any(LoginRequest.class))).thenReturn(response);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"admin\",\"password\":\"wrongpassword\"}"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Invalid username or password"));
    }

    @Test
    void getCurrentUserWithValidTokenReturnsProfile() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        StaffUser user = new StaffUser(1L, "admin", "Commander V. Sharma", "hashed", "ADMIN", "Chief Watch Officer", "2026-10-16T10:00:00Z", null);

        Mockito.when(authService.validateToken("Bearer valid-token")).thenReturn(Optional.of(user));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer valid-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    @Test
    void getCurrentUserWithInvalidTokenReturns401() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        Mockito.when(authService.validateToken("Bearer expired-token")).thenReturn(Optional.empty());

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(get("/api/auth/me")
                        .header("Authorization", "Bearer expired-token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").exists());
    }

    @Test
    void registerNewStaffFailsForNonAdmin() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        StaffUser officerUser = new StaffUser(2L, "officer_vizhinjam", "Lt. Arun Nair", "hashed", "OFFICER", "Nav Officer", "2026-10-16T10:00:00Z", null);

        Mockito.when(authService.validateToken("Bearer officer-token")).thenReturn(Optional.of(officerUser));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(post("/api/auth/register")
                        .header("Authorization", "Bearer officer-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new_guard\",\"password\":\"Secret123!\",\"fullName\":\"Guard 1\",\"role\":\"OFFICER\"}"))
                .andExpect(status().isForbidden());
    }

    @Test
    void registerNewStaffSucceedsForAdmin() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        StaffUser adminUser = new StaffUser(1L, "admin", "Commander Sharma", "hashed", "ADMIN", "Administrator", "2026-10-16T10:00:00Z", null);
        StaffUserDto createdDto = new StaffUserDto(3L, "new_guard", "Guard 1", "OFFICER", "Deck Officer", "2026-10-16T12:30:00Z", null);

        Mockito.when(authService.validateToken("Bearer admin-token")).thenReturn(Optional.of(adminUser));
        Mockito.when(authService.register(any(StaffRegisterRequest.class))).thenReturn(createdDto);

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(post("/api/auth/register")
                        .header("Authorization", "Bearer admin-token")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"new_guard\",\"password\":\"Secret123!\",\"fullName\":\"Guard 1\",\"role\":\"OFFICER\",\"rankTitle\":\"Deck Officer\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.username").value("new_guard"))
                .andExpect(jsonPath("$.role").value("OFFICER"));
    }

    @Test
    void logoutSucceeds() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(post("/api/auth/logout")
                        .header("Authorization", "Bearer some-token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").value("Logged out successfully"));
    }

    @Test
    void getAccountStatusReturnsStatus() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        StaffUser user = new StaffUser(1L, "John Antony", "John Antony", "hash", "ADMIN", "Chief", "2026-10-16T10:00:00Z", null);
        Mockito.when(authService.findUserByUsername("John Antony")).thenReturn(Optional.of(user));

        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(get("/api/auth/status/John Antony"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.username").value("John Antony"))
                .andExpect(jsonPath("$.role").value("ADMIN"))
                .andExpect(jsonPath("$.needsPasswordSetup").value(false));
    }

    @Test
    void recoverPasswordSucceedsWithValidData() throws Exception {
        AuthService authService = Mockito.mock(AuthService.class);
        MockMvc mockMvc = MockMvcBuilders.standaloneSetup(new AuthController(authService)).build();

        mockMvc.perform(post("/api/auth/recover-password")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"Harsha\",\"recoveryKey\":\"VIZHINJAM\",\"newPassword\":\"HarshaSecurePass2026!\",\"confirmPassword\":\"HarshaSecurePass2026!\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.message").exists());
    }
}
