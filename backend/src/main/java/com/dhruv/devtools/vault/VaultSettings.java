package com.dhruv.devtools.vault;

import jakarta.persistence.*;

/** Single-row table (id is always 1) holding the vault's encryption-at-rest configuration. */
@Entity
@Table(name = "vault_settings")
public class VaultSettings {

    @Id
    private Long id = 1L;

    @Column(nullable = false)
    private boolean enabled;

    /** Base64-encoded random salt used to derive the AES key from the user's passphrase via PBKDF2. */
    @Column(length = 100)
    private String saltBase64;

    /** Base64 ciphertext of a known constant, encrypted with the derived key — lets unlock() verify a passphrase without ever storing it. */
    @Lob
    private String verifier;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public String getSaltBase64() { return saltBase64; }
    public void setSaltBase64(String saltBase64) { this.saltBase64 = saltBase64; }
    public String getVerifier() { return verifier; }
    public void setVerifier(String verifier) { this.verifier = verifier; }
}
