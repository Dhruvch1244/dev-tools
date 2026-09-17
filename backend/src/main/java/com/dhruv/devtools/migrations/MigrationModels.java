package com.dhruv.devtools.migrations;

import java.util.List;

public class MigrationModels {

    public enum MigrationTool { FLYWAY, LIQUIBASE }

    public record Risk(String filePath, int line, String kind, String message) {}

    public record MigrationEntry(
            String version,
            String description,
            String fileName,
            String filePath,
            MigrationTool tool,
            List<Risk> risks
    ) {}

    public record ScanResult(
            int filesScanned,
            List<MigrationEntry> migrations,
            List<Risk> risks
    ) {}
}
