package com.dhruv.devtools.vault;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class VaultService {

    private final VaultEntryRepository repository;

    public VaultService(VaultEntryRepository repository) {
        this.repository = repository;
    }

    public record Request(String environment, String name, String url, String username, String secret, String notes) {}

    public List<VaultEntry> list() {
        return repository.findAllByOrderByEnvironmentAscNameAsc();
    }

    public VaultEntry create(Request req) {
        validate(req);
        VaultEntry entry = new VaultEntry();
        apply(entry, req);
        return repository.save(entry);
    }

    public VaultEntry update(Long id, Request req) {
        validate(req);
        VaultEntry entry = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such vault entry: " + id));
        apply(entry, req);
        return repository.save(entry);
    }

    public void delete(Long id) {
        repository.deleteById(id);
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
        entry.setSecret(req.secret());
        entry.setNotes(blankToNull(req.notes()));
    }

    private String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s.trim();
    }
}
