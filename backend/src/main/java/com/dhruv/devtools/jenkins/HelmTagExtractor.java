package com.dhruv.devtools.jenkins;

import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Finds the Helm tag a CD build produced, for later rehydration. Looks in, in order of trust:
 * explicit {@code KEY=value} markers the pipeline echoes, {@code helm upgrade/install} command
 * lines (release, chart, --version, --namespace, image.tag), {@code helm package}/{@code helm push}
 * output, and build parameters whose name looks like a tag. Each pattern's first capture group
 * (or a group named {@code tag}) is the value. Stateful: feed it lines, then call {@link #result}.
 */
public class HelmTagExtractor {

    public record PatternDef(String name, String regex) {}

    public record Match(String pattern, String value, int lineNumber, String line, String source) {}

    public record Release(String release, String chart, String version, String imageTag, String namespace, int lineNumber) {}

    public record Result(String best, String bestSource, List<Match> matches, List<Release> releases, int linesScanned, List<String> patternErrors) {}

    public static final List<PatternDef> DEFAULT_PATTERNS = List.of(
            new PatternDef("HELM_TAG marker", "\\bHELM_TAG\\s*[=:]\\s*[\"']?([\\w.+\\-]+)"),
            new PatternDef("helm.tag / helmTag", "(?i)\\bhelm[._]?tag\\b\\s*[=:]\\s*[\"']?([\\w.+\\-]+)"),
            new PatternDef("CHART_VERSION marker", "\\b(?:CHART_VERSION|HELM_CHART_VERSION)\\s*[=:]\\s*[\"']?([\\w.+\\-]+)"),
            new PatternDef("helm push (OCI)", "Pushed:\\s+\\S+?:([\\w.+\\-]+)\\s*$"),
            new PatternDef("helm package", "Successfully packaged chart and saved it to:\\s*\\S*?[\\w\\-]+-(\\d+\\.\\d+\\.\\d+[\\w.+\\-]*)\\.tgz"),
            new PatternDef("helm upgrade --version", "helm\\s+(?:upgrade|install)\\b.*?--version[ =]+[\"']?([\\w.+\\-]+)"),
            new PatternDef("--set image.tag", "--set(?:-string)?[ =][\\w.\\-]*image\\.tag=[\"']?([\\w.+\\-]+)"),
            new PatternDef("IMAGE_TAG marker", "\\bIMAGE_TAG\\s*[=:]\\s*[\"']?([\\w.+\\-]+)")
    );

    private static final Pattern HELM_CMD = Pattern.compile("helm\\s+(upgrade|install)\\s+(.*)");
    private static final Pattern PARAM_NAME = Pattern.compile("(?i).*(helm.*tag|chart.?version|image.?tag|release.?version).*");
    private static final int MAX_MATCHES = 200;

    private final List<Pattern> compiled = new ArrayList<>();
    private final List<String> names = new ArrayList<>();
    private final List<String> errors = new ArrayList<>();
    private final List<Match> matches = new ArrayList<>();
    private final List<Release> releases = new ArrayList<>();
    private int lineNo = 0;

    public HelmTagExtractor(List<PatternDef> patterns) {
        for (PatternDef p : (patterns == null || patterns.isEmpty()) ? DEFAULT_PATTERNS : patterns) {
            try {
                compiled.add(Pattern.compile(p.regex()));
                names.add(p.name() == null || p.name().isBlank() ? p.regex() : p.name());
            } catch (PatternSyntaxException e) {
                errors.add((p.name() == null ? p.regex() : p.name()) + ": " + e.getDescription());
            }
        }
    }

    private static String value(Matcher m) {
        try {
            String named = m.group("tag");
            if (named != null) return named;
        } catch (IllegalArgumentException ignored) {
            // no group named "tag"
        }
        return m.groupCount() >= 1 ? m.group(1) : m.group();
    }

    /** Strips the "[Pipeline] " prefixes and ANSI colour codes Jenkins consoles are full of. */
    private static String clean(String line) {
        return line.replaceAll("\u001B\\[[;\\d]*m", "").replaceAll("\\[8mha:\\S*\\[0m", "");
    }

    public void line(String raw) {
        lineNo++;
        String line = clean(raw);
        if (matches.size() < MAX_MATCHES) {
            for (int i = 0; i < compiled.size(); i++) {
                Matcher m = compiled.get(i).matcher(line);
                if (m.find()) {
                    String v = value(m);
                    if (v != null && !v.isBlank() && !v.startsWith("$")) {
                        matches.add(new Match(names.get(i), v, lineNo, line.length() > 400 ? line.substring(0, 400) + "…" : line, "console"));
                    }
                }
            }
        }
        Matcher h = HELM_CMD.matcher(line);
        if (h.find() && releases.size() < 50) releases.add(parseHelmCommand(h.group(2), lineNo));
    }

    static Release parseHelmCommand(String args, int lineNo) {
        List<String> tokens = new ArrayList<>(Arrays.asList(args.trim().split("\\s+")));
        List<String> positional = new ArrayList<>();
        String version = null, ns = null, imageTag = null;
        for (int i = 0; i < tokens.size(); i++) {
            String t = tokens.get(i);
            String next = i + 1 < tokens.size() ? tokens.get(i + 1) : null;
            if (t.startsWith("--version")) { version = t.contains("=") ? t.substring(t.indexOf('=') + 1) : next; if (!t.contains("=")) i++; }
            else if (t.equals("-n") || t.startsWith("--namespace")) { ns = t.contains("=") ? t.substring(t.indexOf('=') + 1) : next; if (!t.contains("=")) i++; }
            else if (t.startsWith("--set")) {
                String kv = t.contains("=") && !t.equals("--set") && !t.equals("--set-string") ? t.substring(t.indexOf('=') + 1) : next;
                if (!t.contains("=") || t.equals("--set") || t.equals("--set-string")) i++;
                if (kv != null) for (String pair : kv.split(",")) {
                    int eq = pair.indexOf('=');
                    if (eq > 0 && pair.substring(0, eq).endsWith("image.tag")) imageTag = strip(pair.substring(eq + 1));
                }
            }
            else if (t.equals("--install") || t.equals("-i") || t.equals("--atomic") || t.equals("--wait")) { /* flags without values */ }
            else if (t.startsWith("-")) { if (!t.contains("=") && next != null && !next.startsWith("-") && takesValue(t)) i++; }
            else positional.add(t);
        }
        return new Release(positional.size() > 0 ? positional.get(0) : null, positional.size() > 1 ? positional.get(1) : null,
                strip(version), imageTag, strip(ns), lineNo);
    }

    private static boolean takesValue(String flag) {
        return Set.of("-f", "--values", "--timeout", "--kube-context", "--repo", "--username", "--password", "--description", "--post-renderer").contains(flag);
    }

    private static String strip(String s) {
        return s == null ? null : s.replaceAll("^[\"']|[\"']$", "");
    }

    public void parameters(Map<String, String> params) {
        if (params == null) return;
        params.forEach((k, v) -> {
            if (v != null && !v.isBlank() && PARAM_NAME.matcher(k).matches()) {
                matches.add(new Match("build parameter " + k, v, 0, k + "=" + v, "parameter"));
            }
        });
    }

    public void text(String source, String text) {
        if (text == null || text.isBlank()) return;
        for (int i = 0; i < compiled.size(); i++) {
            Matcher m = compiled.get(i).matcher(text);
            if (m.find()) matches.add(new Match(names.get(i), value(m), 0, text.length() > 300 ? text.substring(0, 300) : text, source));
        }
    }

    /**
     * Best guess: the earliest-listed pattern that matched wins (patterns are ordered by trust);
     * within one pattern the LAST occurrence wins — a pipeline that retried takes its final value.
     */
    public Result result() {
        String best = null, bestSource = null;
        outer:
        for (String name : names) {
            for (int i = matches.size() - 1; i >= 0; i--) {
                Match m = matches.get(i);
                if (m.pattern().equals(name) && !"parameter".equals(m.source())) {
                    best = m.value();
                    bestSource = name + (m.lineNumber() > 0 ? " (line " + m.lineNumber() + ")" : " (" + m.source() + ")");
                    break outer;
                }
            }
        }
        if (best == null) {
            for (Match m : matches) {
                if ("parameter".equals(m.source())) { best = m.value(); bestSource = m.pattern(); break; }
            }
        }
        return new Result(best, bestSource, matches, releases, lineNo, errors);
    }
}
