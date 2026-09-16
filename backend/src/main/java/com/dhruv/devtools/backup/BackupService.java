package com.dhruv.devtools.backup;

import org.springframework.stereotype.Service;

import javax.sql.DataSource;
import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Whole-database backup/restore built on H2's own SCRIPT/RUNSCRIPT commands, so a
 * backup captures every tool's data (history, notes, vault, tasks, command templates, etc.)
 * in one consistent snapshot without needing to know about each entity individually.
 */
@Service
public class BackupService {

    private static final DateTimeFormatter FILENAME_TS = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

    private final DataSource dataSource;

    public BackupService(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public String backupFileName() {
        return "devtools-backup-" + LocalDateTime.now().format(FILENAME_TS) + ".zip";
    }

    /** Writes a full DB snapshot (schema + data, compressed) to a temp file and returns its path. Caller must delete it after streaming. */
    public Path exportBackup() throws SQLException, IOException {
        Path tempFile = Files.createTempFile("devtools-backup-", ".zip");
        Files.deleteIfExists(tempFile);
        String path = tempFile.toAbsolutePath().toString().replace('\\', '/');
        try (Connection conn = dataSource.getConnection();
             PreparedStatement ps = conn.prepareStatement("SCRIPT TO ? COMPRESSION ZIP")) {
            ps.setString(1, path);
            ps.execute();
        }
        return tempFile;
    }

    /** Wipes the current schema and replays a previously exported backup. Irreversible — the caller must have already confirmed with the user. */
    public void importBackup(InputStream uploaded) throws SQLException, IOException {
        Path tempFile = Files.createTempFile("devtools-restore-", ".zip");
        try {
            Files.copy(uploaded, tempFile, StandardCopyOption.REPLACE_EXISTING);
            String path = tempFile.toAbsolutePath().toString().replace('\\', '/');
            try (Connection conn = dataSource.getConnection()) {
                try (PreparedStatement drop = conn.prepareStatement("DROP ALL OBJECTS")) {
                    drop.execute();
                }
                try (PreparedStatement run = conn.prepareStatement("RUNSCRIPT FROM ? COMPRESSION ZIP")) {
                    run.setString(1, path);
                    run.execute();
                }
            }
        } finally {
            Files.deleteIfExists(tempFile);
        }
    }
}
