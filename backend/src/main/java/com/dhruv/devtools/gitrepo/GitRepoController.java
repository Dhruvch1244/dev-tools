package com.dhruv.devtools.gitrepo;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/git-repos")
public class GitRepoController {

    private final GitRepoService service;

    public GitRepoController(GitRepoService service) {
        this.service = service;
    }

    public record AddRequest(String path, String label) {}

    @GetMapping
    public List<SavedGitRepo> list() {
        return service.list();
    }

    @PostMapping
    public SavedGitRepo add(@RequestBody AddRequest req) {
        return service.add(req.path(), req.label());
    }

    @DeleteMapping("/{id}")
    public void remove(@PathVariable Long id) {
        service.remove(id);
    }

    @GetMapping("/{id}/overview")
    public GitRepoService.Overview overview(@PathVariable Long id) {
        return service.overview(id);
    }

    @PostMapping("/{id}/fetch")
    public GitRepoService.Overview fetch(@PathVariable Long id) {
        return service.fetch(id);
    }
}
