package com.dhruv.devtools.mock;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/mock-routes")
public class MockRouteController {

    private final MockRouteService service;

    public MockRouteController(MockRouteService service) {
        this.service = service;
    }

    @GetMapping
    public List<MockRoute> list() {
        return service.list();
    }

    @PostMapping
    public MockRoute create(@RequestBody MockRouteService.RouteSave req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public MockRoute update(@PathVariable Long id, @RequestBody MockRouteService.RouteSave req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }
}
