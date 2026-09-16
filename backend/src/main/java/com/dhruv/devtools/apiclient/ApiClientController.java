package com.dhruv.devtools.apiclient;

import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/api-client")
public class ApiClientController {

    private final ApiClientService service;
    private final ApiExecutionService executionService;

    public ApiClientController(ApiClientService service, ApiExecutionService executionService) {
        this.service = service;
        this.executionService = executionService;
    }

    public record CreateCollectionRequest(String name) {}

    @GetMapping("/collections")
    public List<ApiCollection> listCollections() {
        return service.listCollections();
    }

    @PostMapping("/collections")
    public ApiCollection createCollection(@RequestBody CreateCollectionRequest req) {
        return service.createCollection(req.name());
    }

    @DeleteMapping("/collections/{id}")
    public void deleteCollection(@PathVariable Long id) {
        service.deleteCollection(id);
    }

    @GetMapping("/collections/{id}/requests")
    public List<ApiRequestDef> listRequests(@PathVariable Long id) {
        return service.listRequests(id);
    }

    @PostMapping("/requests")
    public ApiRequestDef saveRequest(@RequestBody ApiClientService.RequestSave req) {
        return service.saveRequest(req);
    }

    @PutMapping("/requests/{id}")
    public ApiRequestDef updateRequest(@PathVariable Long id, @RequestBody ApiClientService.RequestSave req) {
        return service.updateRequest(id, req);
    }

    @DeleteMapping("/requests/{id}")
    public void deleteRequest(@PathVariable Long id) {
        service.deleteRequest(id);
    }

    @PostMapping("/execute")
    public ApiExecutionService.ExecuteResponse execute(@RequestBody ApiExecutionService.ExecuteRequest req) {
        return executionService.execute(req);
    }
}
