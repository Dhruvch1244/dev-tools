package com.dhruv.devtools.plsql;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static com.dhruv.devtools.plsql.PlSqlModels.*;

/**
 * Heuristic, regex-based PL/SQL indexer — NOT a real SQL/PLSQL grammar parser (no such library is
 * pulled in here). It walks CREATE PACKAGE/PROCEDURE/FUNCTION/TRIGGER/VIEW headers, approximates
 * each routine's body as the text between its header and the next sibling header, then looks for
 * table references and calls to other *known* routines (only names this scan already indexed
 * elsewhere count as a "call" — avoids false positives from ordinary function-call-shaped syntax
 * like IF(...) or SUM(...)). Good for exploration/search across a large PL/SQL codebase; treat the
 * call graph and table-usage map as "probably right", not compiler-verified ground truth.
 */
@Service
public class PlSqlAnalyzerService {

    private static final Set<String> EXTENSIONS = Set.of("sql", "pks", "pkb", "prc", "fnc", "trg", "vw", "pls", "plb");

    private static final Pattern PKG_BODY = Pattern.compile("CREATE\\s+(?:OR\\s+REPLACE\\s+)?PACKAGE\\s+BODY\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern PKG_SPEC = Pattern.compile("CREATE\\s+(?:OR\\s+REPLACE\\s+)?PACKAGE\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STANDALONE_PROC = Pattern.compile("CREATE\\s+(?:OR\\s+REPLACE\\s+)?PROCEDURE\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern STANDALONE_FUNC = Pattern.compile("CREATE\\s+(?:OR\\s+REPLACE\\s+)?FUNCTION\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern TRIGGER_HDR = Pattern.compile("CREATE\\s+(?:OR\\s+REPLACE\\s+)?TRIGGER\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern VIEW_HDR = Pattern.compile("CREATE\\s+(?:OR\\s+REPLACE\\s+)?(?:FORCE\\s+)?VIEW\\s+(\\w+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern NESTED_ROUTINE = Pattern.compile("(?m)^\\s*(PROCEDURE|FUNCTION)\\s+(\\w+)", Pattern.CASE_INSENSITIVE);

    private static final Pattern FROM_TABLE = Pattern.compile("\\bFROM\\s+([A-Za-z_][A-Za-z0-9_$#]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern JOIN_TABLE = Pattern.compile("\\bJOIN\\s+([A-Za-z_][A-Za-z0-9_$#]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern INSERT_TABLE = Pattern.compile("\\bINSERT\\s+INTO\\s+([A-Za-z_][A-Za-z0-9_$#]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern UPDATE_TABLE = Pattern.compile("\\bUPDATE\\s+([A-Za-z_][A-Za-z0-9_$#]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern DELETE_TABLE = Pattern.compile("\\bDELETE\\s+FROM\\s+([A-Za-z_][A-Za-z0-9_$#]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern MERGE_TABLE = Pattern.compile("\\bMERGE\\s+INTO\\s+([A-Za-z_][A-Za-z0-9_$#]*)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CALL_REF = Pattern.compile("\\b(\\w+)(?:\\.(\\w+))?\\s*\\(");

    private static final Pattern EXEC_IMMEDIATE = Pattern.compile("EXECUTE\\s+IMMEDIATE", Pattern.CASE_INSENSITIVE);
    private static final Pattern WHEN_OTHERS_NULL = Pattern.compile("WHEN\\s+OTHERS\\s+THEN\\s*NULL\\s*;", Pattern.CASE_INSENSITIVE);
    private static final Pattern WHEN_OTHERS = Pattern.compile("WHEN\\s+OTHERS\\s+THEN", Pattern.CASE_INSENSITIVE);
    private static final Pattern OLD_OUTER_JOIN = Pattern.compile("\\(\\s*\\+\\s*\\)");
    private static final Pattern SELECT_STAR = Pattern.compile("SELECT\\s+\\*\\s+FROM", Pattern.CASE_INSENSITIVE);

    private record RoutineSpan(String name, RoutineKind kind, String packageName, String filePath, int line, String body) {}

    public ScanResult scan(String rootPath) {
        Path root = Path.of(rootPath.trim());
        if (!Files.isDirectory(root)) throw new IllegalArgumentException("Not a directory: " + rootPath);

        List<Path> files;
        try (Stream<Path> walk = Files.walk(root)) {
            files = walk.filter(Files::isRegularFile).filter(p -> EXTENSIONS.contains(extensionOf(p))).toList();
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not scan folder: " + e.getMessage(), e);
        }

        List<RoutineSpan> spans = new ArrayList<>();
        List<Risk> risks = new ArrayList<>();

        for (Path file : files) {
            String text;
            try {
                text = Files.readString(file, StandardCharsets.UTF_8);
            } catch (IOException e) {
                continue;
            }
            String relPath = root.relativize(file).toString().replace('\\', '/');
            collectRisks(text, relPath, risks);

            Matcher pkgBodyM = PKG_BODY.matcher(text);
            if (pkgBodyM.find()) {
                String pkgName = pkgBodyM.group(1);
                spans.add(new RoutineSpan(pkgName, RoutineKind.PACKAGE, null, relPath, lineOf(text, pkgBodyM.start()), ""));
                // Only scan from the BODY header onward — a combined spec+body file has the spec's bare
                // procedure/function declarations earlier in the same text, which would otherwise double-count.
                spans.addAll(nestedRoutineSpans(text, pkgBodyM.start(), pkgName, relPath));
                continue;
            }
            Matcher procM = STANDALONE_PROC.matcher(text);
            if (procM.find()) {
                spans.add(new RoutineSpan(procM.group(1), RoutineKind.PROCEDURE, null, relPath, lineOf(text, procM.start()), text));
                continue;
            }
            Matcher funcM = STANDALONE_FUNC.matcher(text);
            if (funcM.find()) {
                spans.add(new RoutineSpan(funcM.group(1), RoutineKind.FUNCTION, null, relPath, lineOf(text, funcM.start()), text));
                continue;
            }
            Matcher trigM = TRIGGER_HDR.matcher(text);
            if (trigM.find()) {
                spans.add(new RoutineSpan(trigM.group(1), RoutineKind.TRIGGER, null, relPath, lineOf(text, trigM.start()), text));
                continue;
            }
            Matcher pkgSpecM = PKG_SPEC.matcher(text);
            if (pkgSpecM.find()) {
                spans.add(new RoutineSpan(pkgSpecM.group(1), RoutineKind.PACKAGE, null, relPath, lineOf(text, pkgSpecM.start()), ""));
                continue;
            }
            Matcher viewM = VIEW_HDR.matcher(text);
            if (viewM.find()) {
                spans.add(new RoutineSpan(viewM.group(1), RoutineKind.VIEW, null, relPath, lineOf(text, viewM.start()), ""));
            }
        }

        // Known routine names (bare + package-qualified) — only these count as "calls" in pass 2.
        Set<String> knownNames = new HashSet<>();
        Map<String, String> qualifiedByBare = new HashMap<>();
        for (RoutineSpan s : spans) {
            if (s.kind() == RoutineKind.PACKAGE) continue;
            knownNames.add(s.name().toLowerCase());
            if (s.packageName() != null) {
                knownNames.add((s.packageName() + "." + s.name()).toLowerCase());
                qualifiedByBare.putIfAbsent(s.name().toLowerCase(), s.packageName() + "." + s.name());
            }
        }

        List<Routine> routines = new ArrayList<>();
        for (RoutineSpan s : spans) {
            String qualifiedName = s.packageName() != null ? s.packageName() + "." + s.name() : s.name();
            List<String> calls = s.kind() == RoutineKind.PACKAGE ? List.of() : findCalls(s.body(), s.name(), knownNames, qualifiedByBare);
            List<TableRef> tables = s.kind() == RoutineKind.PACKAGE ? List.of() : findTableRefs(s.body());
            routines.add(new Routine(s.name(), qualifiedName, s.kind(), s.packageName(), s.filePath(), s.line(), calls, tables));
        }

        return new ScanResult(files.size(), routines, risks);
    }

    /**
     * Splits a package body into its PROCEDURE/FUNCTION member routines by nested header offsets.
     * `searchFrom` restricts matching to the BODY section of the file (skips the spec section that
     * may precede it in a combined spec+body file); line numbers are still reported against the
     * full original `text` so they point at the right place in the source file.
     */
    private List<RoutineSpan> nestedRoutineSpans(String text, int searchFrom, String pkgName, String relPath) {
        List<RoutineSpan> result = new ArrayList<>();
        Matcher m = NESTED_ROUTINE.matcher(text).region(searchFrom, text.length());
        List<Integer> starts = new ArrayList<>();
        List<String> names = new ArrayList<>();
        List<RoutineKind> kinds = new ArrayList<>();
        while (m.find()) {
            starts.add(m.start());
            names.add(m.group(2));
            kinds.add(m.group(1).equalsIgnoreCase("FUNCTION") ? RoutineKind.FUNCTION : RoutineKind.PROCEDURE);
        }
        for (int i = 0; i < starts.size(); i++) {
            int from = starts.get(i);
            int to = i + 1 < starts.size() ? starts.get(i + 1) : text.length();
            String body = text.substring(from, to);
            result.add(new RoutineSpan(names.get(i), kinds.get(i), pkgName, relPath, lineOf(text, from), body));
        }
        return result;
    }

    private List<String> findCalls(String body, String selfName, Set<String> knownNames, Map<String, String> qualifiedByBare) {
        Set<String> found = new LinkedHashSet<>();
        Matcher m = CALL_REF.matcher(body);
        while (m.find()) {
            String first = m.group(1);
            String second = m.group(2);
            String candidate = second != null ? first + "." + second : first;
            String bare = second != null ? second : first;
            if (bare.equalsIgnoreCase(selfName) && second == null) continue; // skip trivial self-recursion noise from re-matching own header
            String key = candidate.toLowerCase();
            if (knownNames.contains(key)) {
                found.add(candidate);
            } else if (second == null && qualifiedByBare.containsKey(bare.toLowerCase())) {
                found.add(qualifiedByBare.get(bare.toLowerCase()));
            }
        }
        return new ArrayList<>(found);
    }

    private List<TableRef> findTableRefs(String body) {
        List<TableRef> refs = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        addTableMatches(FROM_TABLE, body, TableAccess.READ, refs, seen);
        addTableMatches(JOIN_TABLE, body, TableAccess.READ, refs, seen);
        addTableMatches(INSERT_TABLE, body, TableAccess.WRITE, refs, seen);
        addTableMatches(UPDATE_TABLE, body, TableAccess.WRITE, refs, seen);
        addTableMatches(DELETE_TABLE, body, TableAccess.WRITE, refs, seen);
        addTableMatches(MERGE_TABLE, body, TableAccess.WRITE, refs, seen);
        return refs;
    }

    private void addTableMatches(Pattern p, String body, TableAccess access, List<TableRef> refs, Set<String> seen) {
        Matcher m = p.matcher(body);
        while (m.find()) {
            String table = m.group(1);
            if (SQL_NOISE.contains(table.toLowerCase())) continue;
            String key = access + ":" + table.toLowerCase();
            if (seen.add(key)) refs.add(new TableRef(table, access));
        }
    }

    private static final Set<String> SQL_NOISE = Set.of("dual", "select", "where");

    private void collectRisks(String text, String relPath, List<Risk> risks) {
        addRiskMatches(EXEC_IMMEDIATE, text, relPath, "dynamic-sql", "Dynamic SQL (EXECUTE IMMEDIATE) — verify inputs are bound, not concatenated.", risks);
        addRiskMatches(WHEN_OTHERS_NULL, text, relPath, "swallowed-exception", "WHEN OTHERS THEN NULL — errors are silently discarded here.", risks);
        addRiskMatches(OLD_OUTER_JOIN, text, relPath, "deprecated-join", "Deprecated Oracle outer-join syntax (+) — prefer ANSI LEFT/RIGHT JOIN.", risks);
        addRiskMatches(SELECT_STAR, text, relPath, "select-star", "SELECT * — consider naming columns explicitly.", risks);
        // WHEN OTHERS without NULL immediately after is a softer signal (may re-raise correctly) — only
        // flag it when it's not already caught by the sharper "swallowed exception" pattern above.
        Matcher whenOthers = WHEN_OTHERS.matcher(text);
        Matcher whenOthersNull = WHEN_OTHERS_NULL.matcher(text);
        Set<Integer> nullStarts = new HashSet<>();
        while (whenOthersNull.find()) nullStarts.add(whenOthersNull.start());
        while (whenOthers.find()) {
            if (!nullStarts.contains(whenOthers.start())) {
                risks.add(new Risk(relPath, lineOf(text, whenOthers.start()), "broad-exception", "Broad exception handler (WHEN OTHERS) — make sure it re-raises or logs."));
            }
        }
    }

    private void addRiskMatches(Pattern p, String text, String relPath, String kind, String message, List<Risk> risks) {
        Matcher m = p.matcher(text);
        while (m.find()) {
            risks.add(new Risk(relPath, lineOf(text, m.start()), kind, message));
        }
    }

    private int lineOf(String text, int offset) {
        int line = 1;
        for (int i = 0; i < offset && i < text.length(); i++) {
            if (text.charAt(i) == '\n') line++;
        }
        return line;
    }

    private String extensionOf(Path p) {
        String name = p.getFileName().toString();
        int dot = name.lastIndexOf('.');
        return dot < 0 ? "" : name.substring(dot + 1).toLowerCase();
    }
}
