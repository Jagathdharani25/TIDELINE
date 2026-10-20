package com.tideline.backend.controller;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tideline.backend.model.StaffLocation;
import com.tideline.backend.model.StaffLocationRequest;
import com.tideline.backend.model.StaffUser;
import com.tideline.backend.service.AuthService;
import com.tideline.backend.service.StaffLocationService;

@RestController
@RequestMapping("/api/locations")
public class StaffLocationController {

    private final StaffLocationService locationService;
    private final AuthService authService;

    public StaffLocationController(StaffLocationService locationService, AuthService authService) {
        this.locationService = locationService;
        this.authService = authService;
    }

    @PostMapping("/share")
    public ResponseEntity<?> shareLocation(
            @RequestHeader(value = "Authorization", required = false) String authHeader,
            @RequestBody StaffLocationRequest request) {
        Optional<StaffUser> userOpt = authService.validateToken(authHeader);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized: Valid staff authentication required to share location"));
        }

        try {
            StaffLocation recorded = locationService.recordLocation(userOpt.get(), request);
            return ResponseEntity.ok(Map.of(
                    "success", true,
                    "location", recorded,
                    "communicationNotice", "Live location recorded. Subsequent live updates require a working communication link (Cellular LTE / Satellite / Coastal VHF-DSC)."
            ));
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        }
    }

    @GetMapping
    public ResponseEntity<?> getStaffLocations(@RequestHeader(value = "Authorization", required = false) String authHeader) {
        Optional<StaffUser> userOpt = authService.validateToken(authHeader);
        if (userOpt.isEmpty()) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Unauthorized: Authentication required to view staff locations"));
        }

        List<StaffLocation> locations = locationService.getLatestLocations();
        return ResponseEntity.ok(Map.of(
                "locations", locations,
                "count", locations.size(),
                "notice", "Positions reflect latest transmitted fixes. 'STALE' (>5m) or 'OFFLINE' (>30m) indicates vessel link is degraded or device is in offline mode."
        ));
    }
}
