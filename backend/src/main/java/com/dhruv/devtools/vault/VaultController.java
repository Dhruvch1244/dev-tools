package com.dhruv.devtools.vault;

import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/vault")
public class VaultController {

    private final VaultService service;

    public VaultController(VaultService service) {
        this.service = service;
    }

    @GetMapping
    public List<VaultService.EntryView> list() {
        return service.list();
    }

    @PostMapping
    public VaultService.EntryView create(@RequestBody VaultService.Request req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public VaultService.EntryView update(@PathVariable Long id, @RequestBody VaultService.Request req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    public record PassphraseRequest(String passphrase) {}
    public record RotateRequest(String oldPassphrase, String newPassphrase) {}

    @GetMapping("/encryption/status")
    public VaultService.Status encryptionStatus() {
        return service.status();
    }

    @PostMapping("/encryption/enable")
    public VaultService.Status enableEncryption(@RequestBody PassphraseRequest req) {
        service.enableEncryption(req.passphrase());
        return service.status();
    }

    @PostMapping("/encryption/disable")
    public VaultService.Status disableEncryption(@RequestBody PassphraseRequest req) {
        service.disableEncryption(req.passphrase());
        return service.status();
    }

    @PostMapping("/encryption/unlock")
    public Map<String, Object> unlock(@RequestBody PassphraseRequest req) {
        boolean ok = service.unlock(req.passphrase());
        if (!ok) throw new IllegalArgumentException("Passphrase is incorrect.");
        return Map.of("unlocked", true);
    }

    @PostMapping("/encryption/lock")
    public VaultService.Status lock() {
        service.lock();
        return service.status();
    }

    @PostMapping("/encryption/rotate")
    public VaultService.Status rotatePassphrase(@RequestBody RotateRequest req) {
        service.rotatePassphrase(req.oldPassphrase(), req.newPassphrase());
        return service.status();
    }
}
