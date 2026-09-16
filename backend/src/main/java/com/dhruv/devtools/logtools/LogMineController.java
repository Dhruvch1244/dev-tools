package com.dhruv.devtools.logtools;

import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Pattern;
import java.util.stream.Stream;

/**
 * Naive log-template mining: normalizes each line by replacing numbers/hex/UUIDs/quoted strings
 * with placeholders, groups lines by the resulting template, and returns the most frequent
 * templates — turns "scroll through 50,000 near-duplicate lines" into "here are the 20 distinct
 * things that actually happened, and how often each one did."
 */
@RestController
@RequestMapping("/api/logmine")
public class LogMineController {

    private static final int MAX_LINES = 200_000;
    private static final Pattern UUID_RE = Pattern.compile("[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}");
    private static final Pattern HEX_RE = Pattern.compile("\\b0x[0-9a-fA-F]+\\b");
    // no trailing \b: log values are routinely digit-then-unit ("500ms", "42px") and should still normalize
    private static final Pattern NUM_RE = Pattern.compile("(?<!\\d)\\d+");
    private static final Pattern QUOTED_RE = Pattern.compile("\"[^\"]*\"|'[^']*'");

    public record TemplateGroup(String template, int count, String example) {}
    public record MineResult(long linesScanned, List<TemplateGroup> templates) {}

    public record AnalyzeRequest(String path) {}

    @PostMapping("/analyze")
    public MineResult analyze(@RequestBody AnalyzeRequest req) throws IOException {
        Path file = Path.of(req.path());
        if (!Files.isRegularFile(file)) throw new IllegalArgumentException("Not a file: " + req.path());

        Map<String, int[]> counts = new LinkedHashMap<>(); // template -> [count]
        Map<String, String> examples = new HashMap<>();
        long[] scanned = {0};

        try (Stream<String> lines = Files.lines(file)) {
            lines.limit(MAX_LINES).forEach(line -> {
                scanned[0]++;
                if (line.isBlank()) return;
                String template = normalize(line);
                counts.computeIfAbsent(template, k -> new int[1])[0]++;
                examples.putIfAbsent(template, line.length() > 300 ? line.substring(0, 300) + "…" : line);
            });
        }

        List<TemplateGroup> groups = counts.entrySet().stream()
                .map(e -> new TemplateGroup(e.getKey(), e.getValue()[0], examples.get(e.getKey())))
                .sorted((a, b) -> b.count() - a.count())
                .limit(200)
                .toList();

        return new MineResult(scanned[0], groups);
    }

    private String normalize(String line) {
        String t = line;
        t = QUOTED_RE.matcher(t).replaceAll("\"…\"");
        t = UUID_RE.matcher(t).replaceAll("<uuid>");
        t = HEX_RE.matcher(t).replaceAll("<hex>");
        t = NUM_RE.matcher(t).replaceAll("<n>");
        return t.trim();
    }
}
