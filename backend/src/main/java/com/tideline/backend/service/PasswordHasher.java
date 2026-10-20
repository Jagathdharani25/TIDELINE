package com.tideline.backend.service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.security.SecureRandom;
import java.security.spec.InvalidKeySpecException;
import java.util.HexFormat;

import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.PBEKeySpec;

import org.springframework.stereotype.Component;

/**
 * PasswordHasher — Cryptographically secure password hashing using PBKDF2 with HMAC-SHA256.
 *
 * Security properties:
 * - 16-byte cryptographically secure random salt generated via SecureRandom.
 * - 65,536 iterations of PBKDF2WithHmacSHA256 (NIST SP 800-132 recommendation).
 * - 256-bit derived key length.
 * - Constant-time comparison using MessageDigest.isEqual() to prevent timing attacks.
 * - Format: pbkdf2:sha256:65536:<saltHex>:<hashHex>
 */
@Component
public class PasswordHasher {

    private static final String ALGORITHM = "PBKDF2WithHmacSHA256";
    private static final int ITERATIONS = 65536;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int SALT_BYTES = 16;
    private static final SecureRandom SECURE_RANDOM = new SecureRandom();

    /**
     * Hashes a plaintext password with a newly generated random salt.
     *
     * @param plainPassword Plaintext password
     * @return Formatted hash string containing algorithm, iterations, salt, and hash
     */
    public String hashPassword(String plainPassword) {
        if (plainPassword == null || plainPassword.isEmpty()) {
            throw new IllegalArgumentException("Password cannot be empty");
        }

        byte[] salt = new byte[SALT_BYTES];
        SECURE_RANDOM.nextBytes(salt);

        byte[] hash = pbkdf2(plainPassword.toCharArray(), salt, ITERATIONS, KEY_LENGTH_BITS);

        String saltHex = HexFormat.of().formatHex(salt);
        String hashHex = HexFormat.of().formatHex(hash);

        return String.format("pbkdf2:sha256:%d:%s:%s", ITERATIONS, saltHex, hashHex);
    }

    /**
     * Verifies a plaintext password against a stored PBKDF2 hash string.
     *
     * @param plainPassword Plaintext password supplied during login
     * @param storedHash    Stored hash string from the database
     * @return true if password matches, false otherwise
     */
    public boolean verifyPassword(String plainPassword, String storedHash) {
        if (plainPassword == null || storedHash == null) {
            return false;
        }

        String[] parts = storedHash.split(":");
        if (parts.length != 5 || !parts[0].equals("pbkdf2") || !parts[1].equals("sha256")) {
            return false;
        }

        try {
            int iterations = Integer.parseInt(parts[2]);
            byte[] salt = HexFormat.of().parseHex(parts[3]);
            byte[] expectedHash = HexFormat.of().parseHex(parts[4]);

            byte[] actualHash = pbkdf2(plainPassword.toCharArray(), salt, iterations, expectedHash.length * 8);

            return MessageDigest.isEqual(expectedHash, actualHash);
        } catch (Exception e) {
            return false;
        }
    }

    private byte[] pbkdf2(char[] password, byte[] salt, int iterations, int keyLengthBits) {
        try {
            PBEKeySpec spec = new PBEKeySpec(password, salt, iterations, keyLengthBits);
            SecretKeyFactory skf = SecretKeyFactory.getInstance(ALGORITHM);
            return skf.generateSecret(spec).getEncoded();
        } catch (NoSuchAlgorithmException | InvalidKeySpecException e) {
            throw new IllegalStateException("PBKDF2 hashing failed: " + e.getMessage(), e);
        }
    }
}
