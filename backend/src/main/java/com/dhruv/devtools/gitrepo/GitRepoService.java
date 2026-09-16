package com.dhruv.devtools.gitrepo;

import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Runs a fixed, hardcoded set of read-only (plus `fetch`, which only updates remote-tracking refs)
 * git subcommands against a user-registered local repo path. There is no endpoint that accepts
 * arbitrary git arguments from the frontend — every command below is a literal argument array, so
 * this can never be used to run commit/push/reset/checkout/clean or anything else destructive.
 */
@Service
public class GitRepoService {

    private final SavedGitRepoRepository repository;

    public GitRepoService(SavedGitRepoRepository repository) {
        this.repository = repository;
    }

    public record CommitEntry(String hash, List<String> parents, String author, String date, String subject) {}
    public record BranchEntry(String name, boolean current) {}
    public record RemoteEntry(String name, String url) {}
    public record StashEntry(String ref, String message) {}

    public record Overview(
            String path,
            String label,
            String branch,
            Integer ahead,
            Integer behind,
            List<String> changedFiles,
            List<CommitEntry> recentCommits,
            List<BranchEntry> branches,
            List<RemoteEntry> remotes,
            List<StashEntry> stashes
    ) {}

    public List<SavedGitRepo> list() {
        return repository.findAllByOrderByLabelAsc();
    }

    public SavedGitRepo add(String rawPath, String label) {
        Path path = Path.of(rawPath.trim());
        if (!Files.isDirectory(path)) throw new IllegalArgumentException("Not a directory: " + rawPath);
        if (!Files.exists(path.resolve(".git"))) throw new IllegalArgumentException("Not a git repository (no .git found): " + rawPath);

        SavedGitRepo repo = new SavedGitRepo();
        repo.setPath(path.toAbsolutePath().normalize().toString());
        repo.setLabel(label == null || label.isBlank() ? path.getFileName().toString() : label.trim());
        return repository.save(repo);
    }

    public void remove(Long id) {
        repository.deleteById(id);
    }

    public Overview overview(Long id) {
        SavedGitRepo repo = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such saved repo: " + id));
        return buildOverview(repo);
    }

    public Overview fetch(Long id) {
        SavedGitRepo repo = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such repo: " + id));
        Path dir = Path.of(repo.getPath());
        run(dir, "fetch", "--all", "--prune");
        return buildOverview(repo);
    }

    /**
     * Switches branches — the one exception to this service's otherwise strict "never changes
     * repo state" rule, added deliberately and only after explicit user sign-off. Refuses outright
     * if there are ANY uncommitted changes (not just ones git itself would consider conflicting)
     * so this can never discard work — commit or stash first, same as everywhere else in git.
     */
    public Overview checkout(Long id, String branchName) {
        if (branchName == null || branchName.isBlank()) throw new IllegalArgumentException("Branch name can't be empty.");
        SavedGitRepo repo = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such repo: " + id));
        Path dir = Path.of(repo.getPath());

        String status = tryRun(dir, "status", "--porcelain=v1");
        if (!status.isBlank()) {
            throw new IllegalArgumentException("Refusing to switch branches: there are uncommitted changes. Commit or stash them first.");
        }

        run(dir, "checkout", branchName.trim());
        return buildOverview(repo);
    }

    private Overview buildOverview(SavedGitRepo repo) {
        Path dir = Path.of(repo.getPath());

        String branch = tryRun(dir, "rev-parse", "--abbrev-ref", "HEAD").trim();

        Integer ahead = null;
        Integer behind = null;
        String counts = tryRunQuiet(dir, "rev-list", "--left-right", "--count", "HEAD...@{u}");
        if (counts != null) {
            String[] parts = counts.trim().split("\\s+");
            if (parts.length == 2) {
                try {
                    ahead = Integer.parseInt(parts[0]);
                    behind = Integer.parseInt(parts[1]);
                } catch (NumberFormatException ignored) { /* no upstream configured */ }
            }
        }

        List<String> changedFiles = new ArrayList<>();
        for (String line : tryRun(dir, "status", "--porcelain=v1").split("\n")) {
            if (!line.isBlank()) changedFiles.add(line.trim());
        }

        List<CommitEntry> commits = new ArrayList<>();
        String log = tryRun(dir, "log", "-60", "--date=short", "--format=%H%x1f%P%x1f%an%x1f%ad%x1f%s");
        for (String line : log.split("\n")) {
            if (line.isBlank()) continue;
            String[] f = line.split("", 5);
            if (f.length == 5) {
                List<String> parents = f[1].isBlank() ? List.of() : List.of(f[1].trim().split("\\s+"));
                commits.add(new CommitEntry(f[0], parents, f[2], f[3], f[4]));
            }
        }

        List<BranchEntry> branches = new ArrayList<>();
        String branchOut = tryRun(dir, "branch", "-a", "--format=%(HEAD)%(refname:short)");
        for (String line : branchOut.split("\n")) {
            if (line.isBlank()) continue;
            boolean current = line.startsWith("*");
            branches.add(new BranchEntry(current ? line.substring(1).trim() : line.trim(), current));
        }

        List<RemoteEntry> remotes = new ArrayList<>();
        String remoteOut = tryRun(dir, "remote", "-v");
        var seenRemotes = new java.util.LinkedHashSet<String>();
        for (String line : remoteOut.split("\n")) {
            if (line.isBlank()) continue;
            String[] parts = line.split("\\s+");
            if (parts.length >= 2 && seenRemotes.add(parts[0])) remotes.add(new RemoteEntry(parts[0], parts[1]));
        }

        List<StashEntry> stashes = new ArrayList<>();
        String stashOut = tryRun(dir, "stash", "list", "--format=%gd%x1f%s");
        for (String line : stashOut.split("\n")) {
            if (line.isBlank()) continue;
            String[] f = line.split("", 2);
            if (f.length == 2) stashes.add(new StashEntry(f[0], f[1]));
        }

        return new Overview(repo.getPath(), repo.getLabel(), branch, ahead, behind, changedFiles, commits, branches, remotes, stashes);
    }

    private String tryRun(Path dir, String... args) {
        try {
            return run(dir, args);
        } catch (Exception e) {
            return "";
        }
    }

    private String tryRunQuiet(Path dir, String... args) {
        try {
            return run(dir, args);
        } catch (Exception e) {
            return null;
        }
    }

    private String run(Path dir, String... args) {
        List<String> command = new ArrayList<>();
        command.add("git");
        command.addAll(List.of(args));
        try {
            ProcessBuilder pb = new ProcessBuilder(command).directory(dir.toFile()).redirectErrorStream(false);
            Process process = pb.start();

            StringBuilder out = new StringBuilder();
            StringBuilder err = new StringBuilder();
            try (BufferedReader outReader = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8));
                 BufferedReader errReader = new BufferedReader(new InputStreamReader(process.getErrorStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = outReader.readLine()) != null) out.append(line).append('\n');
                while ((line = errReader.readLine()) != null) err.append(line).append('\n');
            }

            if (!process.waitFor(20, TimeUnit.SECONDS)) {
                process.destroyForcibly();
                throw new IllegalArgumentException("git " + String.join(" ", args) + " timed out.");
            }
            if (process.exitValue() != 0) {
                throw new IllegalArgumentException("git " + String.join(" ", args) + " failed: " + err.toString().trim());
            }
            return out.toString();
        } catch (IOException e) {
            throw new IllegalArgumentException("Could not run git (is it installed and on PATH?): " + e.getMessage(), e);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("git command interrupted.");
        }
    }
}
