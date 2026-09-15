package com.dhruv.devtools.plsql;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/plsql")
public class PlSqlController {

    private final PlSqlAnalyzerService service;

    public PlSqlController(PlSqlAnalyzerService service) {
        this.service = service;
    }

    public record ScanRequest(String path) {}

    @PostMapping("/scan")
    public PlSqlModels.ScanResult scan(@RequestBody ScanRequest req) {
        return service.scan(req.path());
    }
}
