package com.dhruv.devtools.search;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/search")
public class GlobalSearchController {

    private final GlobalSearchService service;

    public GlobalSearchController(GlobalSearchService service) {
        this.service = service;
    }

    @GetMapping
    public List<GlobalSearchResult> search(@RequestParam(defaultValue = "") String q) {
        return service.search(q);
    }
}
