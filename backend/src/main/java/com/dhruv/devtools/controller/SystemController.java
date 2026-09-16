package com.dhruv.devtools.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.Duration;
import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Stream;

@RestController
@RequestMapping("/api/system")
public class SystemController {

    private static final Instant STARTED_AT = Instant.now();

    @GetMapping("/info")
    public Map<String, Object> info() {
        Path dbDir = Paths.get(System.getProperty("user.home"), ".devtools-suite");
        long dbSizeBytes = dirSize(dbDir);

        Map<String, Object> out = new LinkedHashMap<>();
        out.put("javaVersion", System.getProperty("java.version"));
        out.put("os", System.getProperty("os.name") + " " + System.getProperty("os.version"));
        out.put("startedAt", STARTED_AT.toString());
        out.put("uptimeSeconds", Duration.between(STARTED_AT, Instant.now()).getSeconds());
        out.put("dbPath", dbDir.toString());
        out.put("dbSizeBytes", dbSizeBytes);
        out.put("heapUsedBytes", Runtime.getRuntime().totalMemory() - Runtime.getRuntime().freeMemory());
        out.put("heapMaxBytes", Runtime.getRuntime().maxMemory());
        out.put("availableProcessors", Runtime.getRuntime().availableProcessors());
        return out;
    }

    private long dirSize(Path dir) {
        if (!Files.isDirectory(dir)) return 0L;
        try (Stream<Path> walk = Files.walk(dir)) {
            return walk.filter(Files::isRegularFile).mapToLong(p -> {
                try {
                    return Files.size(p);
                } catch (IOException e) {
                    return 0L;
                }
            }).sum();
        } catch (IOException e) {
            return 0L;
        }
    }
}
