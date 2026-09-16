package com.dhruv.devtools.logtools;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Polling-based "tail -f": the frontend calls this every second or two with the offset it last
 * read up to, and gets back only the new bytes since then plus the file's current size (so a
 * truncated/rotated log — new size smaller than the offset — is detected and the client can
 * restart from 0).
 */
@RestController
@RequestMapping("/api/logtail")
public class LogTailController {

    private static final long MAX_INITIAL_READ = 512 * 1024; // don't flood the browser on first open of a huge file

    @GetMapping("/read")
    public Map<String, Object> read(@RequestParam String path, @RequestParam(defaultValue = "-1") long offset) throws IOException {
        Path file = Path.of(path);
        if (!Files.isRegularFile(file)) throw new IllegalArgumentException("Not a file: " + path);
        long size = Files.size(file);

        long start;
        boolean truncated = false;
        if (offset < 0) {
            start = Math.max(0, size - MAX_INITIAL_READ);
        } else if (offset > size) {
            start = 0; // file was rotated/truncated since last poll
            truncated = true;
        } else {
            start = offset;
        }

        List<String> lines = new ArrayList<>();
        if (start < size) {
            try (RandomAccessFile raf = new RandomAccessFile(file.toFile(), "r")) {
                raf.seek(start);
                byte[] buf = new byte[(int) (size - start)];
                raf.readFully(buf);
                String chunk = new String(buf, StandardCharsets.UTF_8);
                for (String line : chunk.split("\n", -1)) {
                    if (!line.isEmpty() || lines.isEmpty()) lines.add(line.endsWith("\r") ? line.substring(0, line.length() - 1) : line);
                }
                // the last "line" might be a partial line if the writer hasn't flushed a trailing
                // newline yet — drop it from the batch and back the offset up so it's re-read whole next poll
                if (!chunk.endsWith("\n") && !lines.isEmpty()) {
                    String partial = lines.remove(lines.size() - 1);
                    size = start + chunk.getBytes(StandardCharsets.UTF_8).length - partial.getBytes(StandardCharsets.UTF_8).length;
                }
            }
        }

        return Map.of("lines", lines, "offset", size, "truncated", truncated);
    }
}
