package com.dhruv.devtools.vault;

import org.springframework.stereotype.Service;

import javax.crypto.Cipher;
import javax.crypto.SecretKeyFactory;
import javax.crypto.spec.GCMParameterSpec;
import javax.crypto.spec.PBEKeySpec;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.SecureRandom;
import java.util.Base64;

/**
 * AES-256-GCM encryption for vault secrets, keyed by a passphrase the user supplies at unlock time.
 * The derived key lives only in memory for the life of this singleton (i.e. until lock() is called
 * or the app restarts) — it is never persisted, so an "unlock" is required again after every restart.
 */
@Service
public class VaultCryptoService {

    private static final String VERIFIER_PLAINTEXT = "devtools-vault-ok";
    private static final int PBKDF2_ITERATIONS = 120_000;
    private static final int KEY_LENGTH_BITS = 256;
    private static final int GCM_IV_LENGTH = 12;
    private static final int GCM_TAG_LENGTH_BITS = 128;

    private final VaultSettingsRepository settingsRepository;
    private volatile SecretKeySpec sessionKey;

    public VaultCryptoService(VaultSettingsRepository settingsRepository) {
        this.settingsRepository = settingsRepository;
    }

    public VaultSettings settings() {
        return settingsRepository.findById(1L).orElseGet(() -> {
            VaultSettings s = new VaultSettings();
            s.setId(1L);
            s.setEnabled(false);
            return s;
        });
    }

    public boolean isEnabled() {
        return settings().isEnabled();
    }

    public boolean isUnlocked() {
        return sessionKey != null;
    }

    public void lock() {
        sessionKey = null;
    }

    /** Enables encryption for the first time: derives a fresh key/salt, stores a verifier, and unlocks the session. Caller must re-encrypt existing secrets under the returned key. */
    public SecretKeySpec beginEnable(String passphrase) {
        if (isEnabled()) throw new IllegalStateException("Encryption is already enabled.");
        if (passphrase == null || passphrase.isBlank()) throw new IllegalArgumentException("Passphrase can't be empty.");
        byte[] salt = randomSalt();
        SecretKeySpec key = deriveKey(passphrase, salt);
        VaultSettings s = settings();
        s.setEnabled(true);
        s.setSaltBase64(Base64.getEncoder().encodeToString(salt));
        s.setVerifier(encryptWith(key, VERIFIER_PLAINTEXT));
        settingsRepository.save(s);
        sessionKey = key;
        return key;
    }

    /** Verifies the passphrase against the stored verifier and, if correct, unlocks the session. Returns false on a wrong passphrase. */
    public boolean unlock(String passphrase) {
        VaultSettings s = settings();
        if (!s.isEnabled()) throw new IllegalStateException("Encryption isn't enabled.");
        SecretKeySpec key = deriveKey(passphrase, Base64.getDecoder().decode(s.getSaltBase64()));
        try {
            String decrypted = decryptWith(key, s.getVerifier());
            if (!VERIFIER_PLAINTEXT.equals(decrypted)) return false;
        } catch (Exception e) {
            return false;
        }
        sessionKey = key;
        return true;
    }

    /** Disables encryption. Caller must have already decrypted and re-saved all secrets as plaintext before calling this. */
    public void disable() {
        VaultSettings s = settings();
        s.setEnabled(false);
        s.setSaltBase64(null);
        s.setVerifier(null);
        settingsRepository.save(s);
        sessionKey = null;
    }

    public record KeyPair(SecretKeySpec oldKey, SecretKeySpec newKey) {}

    /** Rotates to a new passphrase: verifies the old one, derives a new key/salt, and unlocks under the new key. Caller must re-encrypt all secrets from oldKey to newKey. */
    public KeyPair beginRotate(String oldPassphrase, String newPassphrase) {
        if (!unlock(oldPassphrase)) throw new IllegalArgumentException("Current passphrase is incorrect.");
        SecretKeySpec oldKey = sessionKey;
        if (newPassphrase == null || newPassphrase.isBlank()) throw new IllegalArgumentException("New passphrase can't be empty.");
        byte[] salt = randomSalt();
        SecretKeySpec newKey = deriveKey(newPassphrase, salt);
        VaultSettings s = settings();
        s.setSaltBase64(Base64.getEncoder().encodeToString(salt));
        s.setVerifier(encryptWith(newKey, VERIFIER_PLAINTEXT));
        settingsRepository.save(s);
        sessionKey = newKey;
        return new KeyPair(oldKey, newKey);
    }

    public String encrypt(String plaintext) {
        SecretKeySpec key = sessionKey;
        if (key == null) throw new IllegalStateException("Vault is locked. Unlock it first.");
        return encryptWith(key, plaintext);
    }

    public String decrypt(String ciphertext) {
        SecretKeySpec key = sessionKey;
        if (key == null) throw new IllegalStateException("Vault is locked. Unlock it first.");
        return decryptWith(key, ciphertext);
    }

    private static byte[] randomSalt() {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        return salt;
    }

    private static SecretKeySpec deriveKey(String passphrase, byte[] salt) {
        try {
            PBEKeySpec spec = new PBEKeySpec(passphrase.toCharArray(), salt, PBKDF2_ITERATIONS, KEY_LENGTH_BITS);
            SecretKeyFactory factory = SecretKeyFactory.getInstance("PBKDF2WithHmacSHA256");
            byte[] keyBytes = factory.generateSecret(spec).getEncoded();
            return new SecretKeySpec(keyBytes, "AES");
        } catch (Exception e) {
            throw new IllegalStateException("Failed to derive vault key", e);
        }
    }

    private static String encryptWith(SecretKeySpec key, String plaintext) {
        try {
            byte[] iv = new byte[GCM_IV_LENGTH];
            new SecureRandom().nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            byte[] cipherText = cipher.doFinal(plaintext.getBytes(StandardCharsets.UTF_8));
            byte[] out = new byte[iv.length + cipherText.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(cipherText, 0, out, iv.length, cipherText.length);
            return Base64.getEncoder().encodeToString(out);
        } catch (Exception e) {
            throw new IllegalStateException("Encryption failed", e);
        }
    }

    private static String decryptWith(SecretKeySpec key, String base64) {
        try {
            byte[] all = Base64.getDecoder().decode(base64);
            byte[] iv = new byte[GCM_IV_LENGTH];
            System.arraycopy(all, 0, iv, 0, GCM_IV_LENGTH);
            byte[] cipherText = new byte[all.length - GCM_IV_LENGTH];
            System.arraycopy(all, GCM_IV_LENGTH, cipherText, 0, cipherText.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, key, new GCMParameterSpec(GCM_TAG_LENGTH_BITS, iv));
            return new String(cipher.doFinal(cipherText), StandardCharsets.UTF_8);
        } catch (Exception e) {
            throw new IllegalStateException("Decryption failed — wrong passphrase or corrupt data", e);
        }
    }

    public static String encryptWithKey(SecretKeySpec key, String plaintext) { return encryptWith(key, plaintext); }
    public static String decryptWithKey(SecretKeySpec key, String ciphertext) { return decryptWith(key, ciphertext); }
}
