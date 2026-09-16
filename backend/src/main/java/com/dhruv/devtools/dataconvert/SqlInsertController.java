package com.dhruv.devtools.dataconvert;

import org.apache.poi.ss.usermodel.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Converts an uploaded CSV or Excel file's first sheet into SQL INSERT statements. */
@RestController
@RequestMapping("/api/data-convert")
public class SqlInsertController {

    @PostMapping("/csv-to-sql")
    public Map<String, Object> convert(@RequestParam("file") MultipartFile file, @RequestParam String tableName,
                                        @RequestParam(defaultValue = ",") String delimiter,
                                        @RequestParam(defaultValue = "500") int batchSize) throws IOException {
        if (tableName == null || tableName.isBlank()) throw new IllegalArgumentException("Table name can't be empty.");
        String name = file.getOriginalFilename() == null ? "" : file.getOriginalFilename().toLowerCase();
        List<List<String>> rows = name.endsWith(".xlsx") || name.endsWith(".xls")
                ? readExcel(file)
                : readCsv(file, delimiter.isEmpty() ? ',' : delimiter.charAt(0));

        if (rows.isEmpty()) throw new IllegalArgumentException("File has no rows.");
        List<String> header = rows.get(0);
        List<List<String>> data = rows.subList(1, rows.size());

        String columns = header.stream().map(h -> "\"" + h.replace("\"", "\"\"") + "\"").reduce((a, b) -> a + ", " + b).orElse("");
        StringBuilder sql = new StringBuilder();
        int inBatch = 0;
        for (int i = 0; i < data.size(); i++) {
            List<String> row = data.get(i);
            if (inBatch == 0) sql.append("INSERT INTO ").append(tableName.trim()).append(" (").append(columns).append(") VALUES\n");
            sql.append("  (");
            for (int c = 0; c < header.size(); c++) {
                if (c > 0) sql.append(", ");
                sql.append(sqlLiteral(c < row.size() ? row.get(c) : null));
            }
            sql.append(")");
            inBatch++;
            boolean lastRow = i == data.size() - 1;
            boolean batchFull = inBatch >= Math.max(1, batchSize);
            if (batchFull || lastRow) {
                sql.append(";\n");
                inBatch = 0;
            } else {
                sql.append(",\n");
            }
        }

        return Map.of("sql", sql.toString(), "rowCount", data.size(), "columns", header);
    }

    private String sqlLiteral(String v) {
        if (v == null || v.isEmpty()) return "NULL";
        if (v.matches("-?\\d+(\\.\\d+)?")) return v;
        return "'" + v.replace("'", "''") + "'";
    }

    private List<List<String>> readCsv(MultipartFile file, char delimiter) throws IOException {
        List<List<String>> rows = new ArrayList<>();
        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream(), StandardCharsets.UTF_8))) {
            String line;
            while ((line = reader.readLine()) != null) {
                if (line.isEmpty()) continue;
                rows.add(splitCsvLine(line, delimiter));
            }
        }
        return rows;
    }

    private List<String> splitCsvLine(String line, char delimiter) {
        List<String> out = new ArrayList<>();
        StringBuilder cur = new StringBuilder();
        boolean inQuotes = false;
        for (int i = 0; i < line.length(); i++) {
            char c = line.charAt(i);
            if (inQuotes) {
                if (c == '"' && i + 1 < line.length() && line.charAt(i + 1) == '"') {
                    cur.append('"');
                    i++;
                } else if (c == '"') {
                    inQuotes = false;
                } else {
                    cur.append(c);
                }
            } else if (c == '"') {
                inQuotes = true;
            } else if (c == delimiter) {
                out.add(cur.toString());
                cur.setLength(0);
            } else {
                cur.append(c);
            }
        }
        out.add(cur.toString());
        return out;
    }

    private List<List<String>> readExcel(MultipartFile file) throws IOException {
        List<List<String>> rows = new ArrayList<>();
        try (Workbook workbook = WorkbookFactory.create(file.getInputStream())) {
            Sheet sheet = workbook.getSheetAt(0);
            DataFormatter formatter = new DataFormatter();
            for (Row row : sheet) {
                List<String> cells = new ArrayList<>();
                for (Cell cell : row) {
                    cells.add(formatter.formatCellValue(cell));
                }
                rows.add(cells);
            }
        }
        return rows;
    }
}
