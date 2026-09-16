package com.dhruv.devtools.vault;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.spec.SecretKeySpec;
import java.util.List;

@Service
public class VaultService {

    private final VaultEntryRepository repository;
    private final VaultCryptoService crypto;

    public VaultService(VaultEntryRepository repository, VaultCryptoService crypto) {
        this.repository = repository;
        this.crypto = crypto;
    }

    public record Request(String environment, String name, String url, String username, String secret, String notes) {}
    public record Status(boolean enabled, boolean unlocked) {}

    /** true when the entry's secret couldn't be shown because the vault is encrypted and locked. */
    public record EntryView(Long id, String environment, String name, String url, String username, String secret,
                             String notes, java.time.Instant createdAt, java.time.Instant updatedAt, boolean locked) {}

    public Status status() {
        return new Status(crypto.isEnabled(), crypto.isUnlocked());
    }

    public boolean unlock(String passphrase) {
        return crypto.unlock(passphrase);
    }

    public void lock() {
        crypto.lock();
    }

    @Transactional
    public void enableEncryption(String passphrase) {
        List<VaultEntry> all = repository.findAll();
        SecretKeySpec key = crypto.beginEnable(passphrase);
        for (VaultEntry e : all) {
            e.setSecret(VaultCryptoService.encryptWithKey(key, e.getSecret()));
        }
        repository.saveAll(all);
    }

    @Transactional
    public void disableEncryption(String passphrase) {
        if (!crypto.isEnabled()) throw new IllegalStateException("Encryption isn't enabled.");
        if (!crypto.unlock(passphrase)) throw new IllegalArgumentException("Passphrase is incorrect.");
        List<VaultEntry> all = repository.findAll();
        for (VaultEntry e : all) {
            e.setSecret(crypto.decrypt(e.getSecret()));
        }
        repository.saveAll(all);
        crypto.disable();
    }

    @Transactional
    public void rotatePassphrase(String oldPassphrase, String newPassphrase) {
        List<VaultEntry> all = repository.findAll();
        VaultCryptoService.KeyPair keys = crypto.beginRotate(oldPassphrase, newPassphrase);
        for (VaultEntry e : all) {
            String plain = VaultCryptoService.decryptWithKey(keys.oldKey(), e.getSecret());
            e.setSecret(VaultCryptoService.encryptWithKey(keys.newKey(), plain));
        }
        repository.saveAll(all);
    }

    public List<EntryView> list() {
        boolean enabled = crypto.isEnabled();
        boolean unlocked = crypto.isUnlocked();
        return repository.findAllByOrderByEnvironmentAscNameAsc().stream()
                .map(e -> toView(e, enabled, unlocked))
                .toList();
    }

    public EntryView create(Request req) {
        validate(req);
        VaultEntry entry = new VaultEntry();
        apply(entry, req);
        VaultEntry saved = repository.save(entry);
        return toView(saved, crypto.isEnabled(), crypto.isUnlocked());
    }

    public EntryView update(Long id, Request req) {
        validate(req);
        VaultEntry entry = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such vault entry: " + id));
        apply(entry, req);
        VaultEntry saved = repository.save(entry);
        return toView(saved, crypto.isEnabled(), crypto.isUnlocked());
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }

    private EntryView toView(VaultEntry e, boolean encEnabled, boolean unlocked) {
        String secret;
        boolean locked;
        if (!encEnabled) {
            secret = e.getSecret();
            locked = false;
        } else if (unlocked) {
            secret = crypto.decrypt(e.getSecret());
            locked = false;
        } else {
            secret = null;
            locked = true;
        }
        return new EntryView(e.getId(), e.getEnvironment(), e.getName(), e.getUrl(), e.getUsername(), secret,
                e.getNotes(), e.getCreatedAt(), e.getUpdatedAt(), locked);
    }

    private void validate(Request req) {
        if (req.environment() == null || req.environment().isBlank()) throw new IllegalArgumentException("Environment can't be empty.");
        if (req.name() == null || req.name().isBlank()) throw new IllegalArgumentException("Name can't be empty.");
        if (req.secret() == null || req.secret().isBlank()) throw new IllegalArgumentException("Secret can't be empty.");
    }

    private void apply(VaultEntry entry, Request req) {
        entry.setEnvironment(req.environment().trim());
        entry.setName(req.name().trim());
        entry.setUrl(blankToNull(req.url()));
        entry.setUsername(blankToNull(req.username()));
        entry.setSecret(crypto.isEnabled() ? crypto.encrypt(req.secret()) : req.secret());
        entry.setNotes(blankToNull(req.notes()));
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
