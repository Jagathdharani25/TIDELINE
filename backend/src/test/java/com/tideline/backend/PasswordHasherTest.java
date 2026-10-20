package com.tideline.backend;

import org.junit.jupiter.api.Test;

import com.tideline.backend.service.PasswordHasher;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PasswordHasherTest {

    private final PasswordHasher hasher = new PasswordHasher();

    @Test
    void testHashingAndVerification() {
        String password = "SecureOfficerPassword2026!";
        String hash = hasher.hashPassword(password);

        assertNotNull(hash);
        assertTrue(hash.startsWith("pbkdf2:sha256:65536:"));

        // Verify correct password matches
        assertTrue(hasher.verifyPassword(password, hash));

        // Verify incorrect password fails
        assertFalse(hasher.verifyPassword("WrongPassword!", hash));
        assertFalse(hasher.verifyPassword("", hash));
        assertFalse(hasher.verifyPassword(null, hash));
    }

    @Test
    void testSaltsAreUnique() {
        String password = "SamePassword123";
        String hash1 = hasher.hashPassword(password);
        String hash2 = hasher.hashPassword(password);

        // Even with the same plaintext password, distinct salts must produce distinct hashes
        assertNotEquals(hash1, hash2);

        assertTrue(hasher.verifyPassword(password, hash1));
        assertTrue(hasher.verifyPassword(password, hash2));
    }
}
