package com.dhruv.devtools.commands;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/command-templates")
public class CommandTemplateController {

    private final CommandTemplateService service;

    public CommandTemplateController(CommandTemplateService service) {
        this.service = service;
    }

    @GetMapping
    public List<CommandTemplate> list() {
        return service.listTemplates();
    }

    @PostMapping
    public CommandTemplate create(@RequestBody CommandTemplateService.TemplateRequest req) {
        return service.createTemplate(req);
    }

    @PutMapping("/{id}")
    public CommandTemplate update(@PathVariable Long id, @RequestBody CommandTemplateService.TemplateRequest req) {
        return service.updateTemplate(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.deleteTemplate(id);
    }

    @GetMapping("/history")
    public List<CommandHistoryEntry> history() {
        return service.listHistory();
    }

    @PostMapping("/history")
    public CommandHistoryEntry addHistory(@RequestBody CommandTemplateService.HistoryRequest req) {
        return service.addHistory(req);
    }

    @DeleteMapping("/history/{id}")
    public void deleteHistory(@PathVariable Long id) {
        service.deleteHistory(id);
    }

    @DeleteMapping("/history")
    public void clearHistory() {
        service.clearHistory();
    }
}
