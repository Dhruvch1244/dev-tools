package com.dhruv.devtools.migrations;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

import static com.dhruv.devtools.migrations.MigrationModels.*;

/**
 * Heuristic, regex/tag-based migration-history scanner — NOT a real Flyway/Liquibase engine (it
 * never talks to a database or resolves Liquibase &lt;include&gt; chains). Flyway migrations are
 * recognized purely by filename convention (V/U/R + version + double-underscore description);
 * Liquibase changeSets are found by content-sniffing a {@code <databaseChangeLog>} root tag and
 * regex-matching {@code <changeSet id="..." author="...">} in file order. Good for a quick
 * chronological overview and catching obviously risky DDL before it ships, not a substitute for
 * actually running the migration tool.
 */
@Service
public class MigrationScanService {

    private static final Pattern FLYWAY_VERSIONED = Pattern.compile("^([VU])([0-9]+(?:[._][0-9]+)*)__(.+)\\.sql$", Pattern.CASE_INSENSITIVE);
    private static final Pattern FLYWAY_REPEATABLE = Pattern.compile("^R__(.+)\\.sql$", Pattern.CASE_INSENSITIVE);

    private static final Pattern LIQUIBASE_ROOT = Pattern.compile("<databaseChangeLog\\b");
    private static final Pattern CHANGE_SET = Pattern.compile("<changeSet\\s+[^>]*\\bid=\"([^\"]*)\"[^>]*\\bauthor=\"([^\"]*)\"[^>]*>", Pattern.CASE_INSENSITIVE);
    private static final Pattern COMMENT_TAG = Pattern.compile("<comment>\\s*([^<]*?)\\s*</comment>", Pattern.CASE_INSENSITIVE);

    private static final Pattern DROP_TABLE = Pattern.compile("\\bDROP\\s+TABLE\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern DROP_COLUMN = Pattern.compile("\\bDROP\\s+COLUMN\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern TRUNCATE = Pattern.compile("\\bTRUNCATE\\s+TABLE\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern RENAME = Pattern.compile("\\bRENAME\\s+(COLUMN|TABLE)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern DELETE_NO_WHERE = Pattern.compile("\\bDELETE\\s+FROM\\s+[A-Za-z_][A-Za-z0-9_$#]*\\s*;", Pattern.CASE_INSENSITIVE);
    private static final Pattern ADD_NOT_NULL = Pattern.compile("\\bADD\\s+(?:COLUMN\\s+)?[A-Za-z_][A-Za-z0-9_$#]*\\s+[A-Za-z0-9_() ]+?\\bNOT\\s+NULL\\b(?!.{0,40}DEFAULT)", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    private static final Pattern LB_DROP_TABLE = Pattern.compile("<dropTable\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LB_DROP_COLUMN = Pattern.compile("<dropColumn\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LB_DELETE = Pattern.compile("<delete\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LB_TRUNCATE = Pattern.compile("<truncateTable\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LB_RENAME = Pattern.compile("<rename(Column|Table)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern LB_NOT_NULL = Pattern.compile("<addNotNullConstraint\\b(?!.{0,120}defaultNullValue)", Pattern.CASE_INSENSITIVE | Pattern.DOTALL);

    public ScanResult scan(String rootPath) {
        Path root = Path.of(rootPath.trim());
        if (!Files.isDirectory(root)) throw new IllegalArgumentException("Not a directory: " + rootPath);

        List<Path> files;
        try (Stream<Path> walk = Files.walk(root)) {
            files = walk.filter(Files::isRegularFile)
                    .filter(p -> extensionOf(p).equals("sql") || extensionOf(p).equals("xml"))
                    .toList();
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not scan folder: " + e.getMessage(), e);
        }

        List<MigrationEntry> migrations = new ArrayList<>();
        List<Risk> allRisks = new ArrayList<>();

        for (Path file : files) {
            String text;
            try {
                text = Files.readString(file, StandardCharsets.UTF_8);
            } catch (IOException e) {
                continue;
            }
            String relPath = root.relativize(file).toString().replace('\\', '/');
            String fileName = file.getFileName().toString();

            if (extensionOf(file).equals("sql")) {
                scanFlywayFile(fileName, relPath, text, migrations, allRisks);
            } else if (LIQUIBASE_ROOT.matcher(text).find()) {
                scanLiquibaseFile(fileName, relPath, text, migrations, allRisks);
            }
        }

        migrations.sort(Comparator
                .comparing((MigrationEntry m) -> m.tool() == MigrationTool.FLYWAY ? 0 : 1)
                .thenComparing(m -> m.tool() == MigrationTool.FLYWAY ? versionSortKey(m.version()) : m.filePath()));

        return new ScanResult(files.size(), migrations, allRisks);
    }

    private void scanFlywayFile(String fileName, String relPath, String text, List<MigrationEntry> migrations, List<Risk> allRisks) {
        Matcher versioned = FLYWAY_VERSIONED.matcher(fileName);
        String version;
        String description;
        MigrationTool tool = MigrationTool.FLYWAY;
        if (versioned.matches()) {
            String prefix = versioned.group(1).toUpperCase();
            version = (prefix.equals("U") ? "U" : "V") + versioned.group(2);
            description = humanize(versioned.group(3));
        } else {
            Matcher repeatable = FLYWAY_REPEATABLE.matcher(fileName);
            if (!repeatable.matches()) return; // not a recognized Flyway filename — skip, not a migration this scanner can order
            version = "R";
            description = humanize(repeatable.group(1));
        }

        List<Risk> risks = new ArrayList<>();
        addRiskMatches(DROP_TABLE, text, relPath, "drop-table", "Drops a table — irreversible, verify backups/rollback plan.", risks);
        addRiskMatches(DROP_COLUMN, text, relPath, "drop-column", "Drops a column — data loss if not backed up.", risks);
        addRiskMatches(TRUNCATE, text, relPath, "truncate", "Truncates a table — irreversible data loss.", risks);
        addRiskMatches(RENAME, text, relPath, "rename", "Renames a column/table — breaks anything still using the old name until deployed in lockstep.", risks);
        addRiskMatches(DELETE_NO_WHERE, text, relPath, "delete-no-where", "DELETE with no WHERE clause — deletes every row in the table.", risks);
        addRiskMatches(ADD_NOT_NULL, text, relPath, "not-null-no-default", "Adds a NOT NULL column with no DEFAULT — fails on a non-empty table on most databases.", risks);

        allRisks.addAll(risks);
        migrations.add(new MigrationEntry(version, description, fileName, relPath, tool, risks));
    }

    private void scanLiquibaseFile(String fileName, String relPath, String text, List<MigrationEntry> migrations, List<Risk> allRisks) {
        Matcher m = CHANGE_SET.matcher(text);
        List<String> ids = new ArrayList<>();
        List<String> authors = new ArrayList<>();
        List<Integer> starts = new ArrayList<>();
        while (m.find()) {
            ids.add(m.group(1));
            authors.add(m.group(2));
            starts.add(m.end());
        }
        for (int i = 0; i < starts.size(); i++) {
            int from = starts.get(i);
            int to = i + 1 < starts.size() ? findChangeSetTagStart(text, starts, i + 1) : text.length();
            String body = text.substring(from, Math.min(to, text.length()));

            Matcher commentM = COMMENT_TAG.matcher(body);
            String description = commentM.find() ? commentM.group(1) : "changeSet " + ids.get(i) + " (" + authors.get(i) + ")";

            List<Risk> risks = new ArrayList<>();
            int line = lineOf(text, starts.get(i));
            addRiskMatches(LB_DROP_TABLE, body, relPath, "drop-table", "Drops a table — irreversible, verify backups/rollback plan.", risks, line);
            addRiskMatches(LB_DROP_COLUMN, body, relPath, "drop-column", "Drops a column — data loss if not backed up.", risks, line);
            addRiskMatches(LB_DELETE, body, relPath, "delete", "<delete> change — confirm it's scoped with a <where> clause.", risks, line);
            addRiskMatches(LB_TRUNCATE, body, relPath, "truncate", "Truncates a table — irreversible data loss.", risks, line);
            addRiskMatches(LB_RENAME, body, relPath, "rename", "Renames a column/table — breaks anything still using the old name until deployed in lockstep.", risks, line);
            addRiskMatches(LB_NOT_NULL, body, relPath, "not-null-no-default", "Adds a NOT NULL constraint with no defaultNullValue — fails on existing NULL rows.", risks, line);

            allRisks.addAll(risks);
            migrations.add(new MigrationEntry(ids.get(i), description, fileName, relPath, MigrationTool.LIQUIBASE, risks));
        }
    }

    private int findChangeSetTagStart(String text, List<Integer> starts, int nextIndex) {
        // starts[] holds the END offset of each <changeSet ...> opening tag; searching for the next
        // tag's literal "<changeSet" substring right before its recorded end is enough to bound this span.
        int approxEnd = starts.get(nextIndex);
        int tagStart = text.lastIndexOf("<changeSet", approxEnd);
        return tagStart >= 0 ? tagStart : approxEnd;
    }

    private String humanize(String slug) {
        String spaced = slug.replace('_', ' ').replace('-', ' ').trim();
        return spaced.isEmpty() ? slug : Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    /** Zero-padded, dot-joined numeric key so "V2" sorts before "V10" and "V1.1" sorts before "V1.2". */
    private String versionSortKey(String version) {
        String digits = version.replaceAll("^[VU]", "");
        String[] parts = digits.split("[._]");
        StringBuilder key = new StringBuilder();
        for (String part : parts) {
            key.append(String.format("%20s", part).replace(' ', '0')).append('.');
        }
        return key.toString();
    }

    private void addRiskMatches(Pattern p, String text, String relPath, String kind, String message, List<Risk> risks) {
        Matcher m = p.matcher(text);
        while (m.find()) {
            risks.add(new Risk(relPath, lineOf(text, m.start()), kind, message));
        }
    }

    private void addRiskMatches(Pattern p, String body, String relPath, String kind, String message, List<Risk> risks, int baseLine) {
        Matcher m = p.matcher(body);
        while (m.find()) {
            risks.add(new Risk(relPath, baseLine, kind, message));
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
