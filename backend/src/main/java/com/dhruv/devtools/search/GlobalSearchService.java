package com.dhruv.devtools.search;

import com.dhruv.devtools.apiclient.ApiCollection;
import com.dhruv.devtools.apiclient.ApiCollectionRepository;
import com.dhruv.devtools.apiclient.ApiRequestDef;
import com.dhruv.devtools.apiclient.ApiRequestDefRepository;
import com.dhruv.devtools.commands.CommandTemplate;
import com.dhruv.devtools.commands.CommandTemplateRepository;
import com.dhruv.devtools.notes.model.Note;
import com.dhruv.devtools.notes.repo.NoteRepository;
import com.dhruv.devtools.tasks.TaskItemRepository;
import com.dhruv.devtools.tasks.model.TaskItem;
import com.dhruv.devtools.vault.VaultEntry;
import com.dhruv.devtools.vault.VaultEntryRepository;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Searches every tool's persisted text data in one pass. Deliberately excludes Vault secrets
 * and notes (only name/environment/url/username are searched) so a global search can never
 * surface a credential, whether or not the vault is currently locked.
 */
@Service
public class GlobalSearchService {

    private static final int MAX_PER_TOOL = 20;

    private final NoteRepository notes;
    private final TaskItemRepository tasks;
    private final VaultEntryRepository vaultEntries;
    private final CommandTemplateRepository templates;
    private final ApiCollectionRepository apiCollections;
    private final ApiRequestDefRepository apiRequests;

    public GlobalSearchService(NoteRepository notes, TaskItemRepository tasks, VaultEntryRepository vaultEntries,
                                CommandTemplateRepository templates,
                                ApiCollectionRepository apiCollections, ApiRequestDefRepository apiRequests) {
        this.notes = notes;
        this.tasks = tasks;
        this.vaultEntries = vaultEntries;
        this.templates = templates;
        this.apiCollections = apiCollections;
        this.apiRequests = apiRequests;
    }

    public List<GlobalSearchResult> search(String rawQuery) {
        String q = rawQuery == null ? "" : rawQuery.trim();
        if (q.length() < 2) return List.of();
        String needle = q.toLowerCase();

        List<GlobalSearchResult> out = new ArrayList<>();
        searchNotes(needle, out);
        searchTasks(needle, out);
        searchVault(needle, out);
        searchTemplates(needle, out);
        searchApiClient(needle, out);
        return out;
    }

    private void searchNotes(String needle, List<GlobalSearchResult> out) {
        int count = 0;
        for (Note n : notes.findAll()) {
            if (count >= MAX_PER_TOOL) break;
            String title = orEmpty(n.getTitle());
            String body = orEmpty(n.getBody());
            if (contains(title, needle) || contains(body, needle)) {
                out.add(new GlobalSearchResult("notes", "Note", String.valueOf(n.getId()), title, snippet(contains(title, needle) ? title : body, needle)));
                count++;
            }
        }
    }

    private void searchTasks(String needle, List<GlobalSearchResult> out) {
        int count = 0;
        for (TaskItem t : tasks.findAll()) {
            if (count >= MAX_PER_TOOL) break;
            String title = orEmpty(t.getTitle());
            String taskNotes = orEmpty(t.getNotes());
            if (contains(title, needle) || contains(taskNotes, needle)) {
                out.add(new GlobalSearchResult("task-list", "Task", String.valueOf(t.getId()), title, snippet(contains(title, needle) ? title : taskNotes, needle)));
                count++;
            }
        }
    }

    private void searchVault(String needle, List<GlobalSearchResult> out) {
        int count = 0;
        for (VaultEntry v : vaultEntries.findAll()) {
            if (count >= MAX_PER_TOOL) break;
            String name = orEmpty(v.getName());
            String env = orEmpty(v.getEnvironment());
            String url = orEmpty(v.getUrl());
            String username = orEmpty(v.getUsername());
            if (contains(name, needle) || contains(env, needle) || contains(url, needle) || contains(username, needle)) {
                out.add(new GlobalSearchResult("vault", "Vault entry", String.valueOf(v.getId()), name + " (" + env + ")", url.isEmpty() ? username : url));
                count++;
            }
        }
    }

    private void searchTemplates(String needle, List<GlobalSearchResult> out) {
        int count = 0;
        for (CommandTemplate t : templates.findAll()) {
            if (count >= MAX_PER_TOOL) break;
            String name = orEmpty(t.getName());
            String template = orEmpty(t.getTemplate());
            if (contains(name, needle) || contains(template, needle)) {
                out.add(new GlobalSearchResult("command-templates", "Command Template", String.valueOf(t.getId()), name, snippet(template, needle)));
                count++;
            }
        }
    }

    private void searchApiClient(String needle, List<GlobalSearchResult> out) {
        int count = 0;
        for (ApiCollection c : apiCollections.findAll()) {
            if (count >= MAX_PER_TOOL) break;
            if (contains(orEmpty(c.getName()), needle)) {
                out.add(new GlobalSearchResult("api-client", "API Collection", String.valueOf(c.getId()), c.getName(), "Collection"));
                count++;
            }
            for (ApiRequestDef r : apiRequests.findAllByCollectionIdOrderByNameAsc(c.getId())) {
                if (count >= MAX_PER_TOOL) break;
                String name = orEmpty(r.getName());
                String url = orEmpty(r.getUrl());
                if (contains(name, needle) || contains(url, needle)) {
                    out.add(new GlobalSearchResult("api-client", "API Request", String.valueOf(r.getId()), r.getMethod() + " " + name, url));
                    count++;
                }
            }
        }
    }

    private boolean contains(String haystack, String needle) {
        return haystack.toLowerCase().contains(needle);
    }

    private String orEmpty(String s) {
        return s == null ? "" : s;
    }

    private String snippet(String text, String needle) {
        if (text.isEmpty()) return "";
        int idx = text.toLowerCase().indexOf(needle);
        if (idx < 0) return text.length() > 100 ? text.substring(0, 100) + "…" : text;
        int start = Math.max(0, idx - 40);
        int end = Math.min(text.length(), idx + needle.length() + 60);
        String prefix = start > 0 ? "…" : "";
        String suffix = end < text.length() ? "…" : "";
        return prefix + text.substring(start, end).replace('\n', ' ') + suffix;
    }
}
