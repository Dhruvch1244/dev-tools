package com.dhruv.devtools.commands;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class CommandTemplateService {

    private static final int MAX_HISTORY = 300;

    private final CommandTemplateRepository templateRepository;
    private final CommandHistoryRepository historyRepository;

    public CommandTemplateService(CommandTemplateRepository templateRepository, CommandHistoryRepository historyRepository) {
        this.templateRepository = templateRepository;
        this.historyRepository = historyRepository;
    }

    public record TemplateRequest(String name, String template) {}
    public record HistoryRequest(String templateName, String renderedCommand, String valuesJson) {}

    public List<CommandTemplate> listTemplates() {
        return templateRepository.findAllByOrderByNameAsc();
    }

    public CommandTemplate createTemplate(TemplateRequest req) {
        validate(req);
        CommandTemplate t = new CommandTemplate();
        t.setName(req.name().trim());
        t.setTemplate(req.template());
        return templateRepository.save(t);
    }

    public CommandTemplate updateTemplate(Long id, TemplateRequest req) {
        validate(req);
        CommandTemplate t = templateRepository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such template: " + id));
        t.setName(req.name().trim());
        t.setTemplate(req.template());
        return templateRepository.save(t);
    }

    public void deleteTemplate(Long id) {
        templateRepository.deleteById(id);
    }

    public List<CommandHistoryEntry> listHistory() {
        return historyRepository.findAllByOrderByCreatedAtDesc();
    }

    public CommandHistoryEntry addHistory(HistoryRequest req) {
        if (req.renderedCommand() == null || req.renderedCommand().isBlank()) {
            throw new IllegalArgumentException("Rendered command can't be empty.");
        }
        CommandHistoryEntry entry = new CommandHistoryEntry();
        entry.setTemplateName(req.templateName() == null || req.templateName().isBlank() ? "(ad hoc)" : req.templateName().trim());
        entry.setRenderedCommand(req.renderedCommand());
        entry.setValuesJson(req.valuesJson());
        CommandHistoryEntry saved = historyRepository.save(entry);
        trimHistory();
        return saved;
    }

    public void deleteHistory(Long id) {
        historyRepository.deleteById(id);
    }

    public void clearHistory() {
        historyRepository.deleteAll();
    }

    private void trimHistory() {
        List<CommandHistoryEntry> all = historyRepository.findAllByOrderByCreatedAtDesc();
        if (all.size() > MAX_HISTORY) {
            historyRepository.deleteAll(all.subList(MAX_HISTORY, all.size()));
        }
    }

    private void validate(TemplateRequest req) {
        if (req.name() == null || req.name().isBlank()) throw new IllegalArgumentException("Template name can't be empty.");
        if (req.template() == null || req.template().isBlank()) throw new IllegalArgumentException("Template text can't be empty.");
    }
}
