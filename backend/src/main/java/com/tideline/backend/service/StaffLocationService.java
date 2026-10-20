package com.tideline.backend.service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import com.tideline.backend.model.StaffLocation;
import com.tideline.backend.model.StaffLocationRequest;
import com.tideline.backend.model.StaffUser;
import com.tideline.backend.repository.StaffLocationRepository;

@Service
public class StaffLocationService {

    private static final Logger log = LoggerFactory.getLogger(StaffLocationService.class);

    private final StaffLocationRepository locationRepository;

    public StaffLocationService(StaffLocationRepository locationRepository) {
        this.locationRepository = locationRepository;
    }

    public StaffLocation recordLocation(StaffUser user, StaffLocationRequest req) {
        if (user == null) {
            throw new IllegalArgumentException("User must be authenticated to share location");
        }
        if (req == null || req.getLatitude() == null || req.getLongitude() == null) {
            throw new IllegalArgumentException("Valid latitude and longitude are required");
        }

        String now = Instant.now().toString();
        String vessel = (req.getVesselName() != null && !req.getVesselName().isBlank())
                ? req.getVesselName().trim()
                : "TIDELINE-" + user.getUsername().toUpperCase();

        StaffLocation location = new StaffLocation(
                null,
                user.getId(),
                user.getUsername(),
                user.getFullName(),
                user.getRole(),
                req.getLatitude(),
                req.getLongitude(),
                req.getAccuracy(),
                req.getSpeed(),
                req.getHeading(),
                now,
                vessel,
                req.getStatusNote()
        );

        locationRepository.save(location);
        location.setFreshness("ACTIVE");

        log.info("Recorded location update from staff '{}' ({}) at [{}, {}]",
                user.getUsername(), vessel, req.getLatitude(), req.getLongitude());

        return location;
    }

    public List<StaffLocation> getLatestLocations() {
        List<StaffLocation> locations = locationRepository.findAllLatest();
        Instant now = Instant.now();

        for (StaffLocation loc : locations) {
            loc.setFreshness(computeFreshness(loc.getSharedAt(), now));
        }

        return locations;
    }

    public static String computeFreshness(String sharedAtIso, Instant referenceNow) {
        if (sharedAtIso == null) return "OFFLINE";
        try {
            Instant shared = Instant.parse(sharedAtIso);
            long minutes = Duration.between(shared, referenceNow).toMinutes();
            if (minutes < 5) {
                return "ACTIVE";
            } else if (minutes < 30) {
                return "STALE";
            } else {
                return "OFFLINE";
            }
        } catch (Exception e) {
            return "OFFLINE";
        }
    }
}
