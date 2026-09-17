package com.dhruv.devtools.migrations;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/migrations")
public class MigrationController {

    private final MigrationScanService service;

    public MigrationController(MigrationScanService service) {
        this.service = service;
    }

    public record ScanRequest(String path) {}

    @PostMapping("/scan")
    public MigrationModels.ScanResult scan(@RequestBody ScanRequest req) {
        if (req.path() == null || req.path().isBlank()) {
            throw new IllegalArgumentException("Give me a folder path containing Flyway/Liquibase migration files.");
        }
        return service.scan(req.path().trim());
    }
}
