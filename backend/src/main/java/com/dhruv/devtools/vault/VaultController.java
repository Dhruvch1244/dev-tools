package com.dhruv.devtools.vault;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/vault")
public class VaultController {

    private final VaultService service;

    public VaultController(VaultService service) {
        this.service = service;
    }

    @GetMapping
    public List<VaultEntry> list() {
        return service.list();
    }

    @PostMapping
    public VaultEntry create(@RequestBody VaultService.Request req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public VaultEntry update(@PathVariable Long id, @RequestBody VaultService.Request req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
