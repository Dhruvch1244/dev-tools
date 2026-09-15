package com.dhruv.devtools.plsql;

import java.util.List;

public class PlSqlModels {

    public enum RoutineKind { PACKAGE, PROCEDURE, FUNCTION, TRIGGER, VIEW }
    public enum TableAccess { READ, WRITE }

    public record TableRef(String table, TableAccess access) {}

    public record Routine(
            String name,
            String qualifiedName,
            RoutineKind kind,
            String packageName,
            String filePath,
            int line,
            List<String> calls,
            List<TableRef> tables
    ) {}

    public record Risk(String filePath, int line, String kind, String message) {}

    public record ScanResult(
            int filesScanned,
            List<Routine> routines,
            List<Risk> risks
    ) {}
}
