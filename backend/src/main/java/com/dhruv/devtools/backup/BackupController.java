package com.dhruv.devtools.backup;

import org.springframework.core.io.FileSystemResource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.SQLException;
import java.util.Map;

@RestController
@RequestMapping("/api/backup")
public class BackupController {

    private final BackupService backupService;

    public BackupController(BackupService backupService) {
        this.backupService = backupService;
    }

    @GetMapping("/export")
    public ResponseEntity<FileSystemResource> export() throws SQLException, IOException {
        Path file = backupService.exportBackup();
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + backupService.backupFileName() + "\"")
                .contentLength(Files.size(file))
                .body(new FileSystemResource(file) {
                    @Override
                    public java.io.InputStream getInputStream() throws IOException {
                        java.io.InputStream in = super.getInputStream();
                        return new java.io.FilterInputStream(in) {
                            @Override
                            public void close() throws IOException {
                                super.close();
                                Files.deleteIfExists(file);
                            }
                        };
                    }
                });
    }

    @PostMapping("/import")
    public Map<String, String> restore(@RequestParam("file") MultipartFile file) throws SQLException, IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("No backup file uploaded.");
        backupService.importBackup(file.getInputStream());
        return Map.of("status", "restored");
    }
}
