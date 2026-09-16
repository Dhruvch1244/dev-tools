package com.dhruv.devtools.apiclient;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ApiClientService {

    private final ApiCollectionRepository collections;
    private final ApiRequestDefRepository requests;
    private final ApiEnvironmentRepository environments;

    public ApiClientService(ApiCollectionRepository collections, ApiRequestDefRepository requests, ApiEnvironmentRepository environments) {
        this.collections = collections;
        this.requests = requests;
        this.environments = environments;
    }

    public record RequestSave(Long collectionId, String name, String method, String url, String headersJson, String body) {}
    public record EnvironmentSave(Long collectionId, String name, String variablesJson) {}

    public List<ApiCollection> listCollections() {
        return collections.findAllByOrderByNameAsc();
    }

    public ApiCollection createCollection(String name) {
        if (name == null || name.isBlank()) throw new IllegalArgumentException("Collection name can't be empty.");
        ApiCollection c = new ApiCollection();
        c.setName(name.trim());
        return collections.save(c);
    }

    @Transactional
    public void deleteCollection(Long id) {
        requests.deleteAllByCollectionId(id);
        environments.deleteAllByCollectionId(id);
        collections.deleteById(id);
    }

    public List<ApiEnvironment> listEnvironments(Long collectionId) {
        return environments.findAllByCollectionIdOrderByNameAsc(collectionId);
    }

    public ApiEnvironment saveEnvironment(EnvironmentSave req) {
        if (req.name() == null || req.name().isBlank()) throw new IllegalArgumentException("Environment name can't be empty.");
        if (!collections.existsById(req.collectionId())) throw new IllegalArgumentException("No such collection: " + req.collectionId());
        ApiEnvironment e = new ApiEnvironment();
        e.setCollectionId(req.collectionId());
        applyEnv(e, req);
        return environments.save(e);
    }

    public ApiEnvironment updateEnvironment(Long id, EnvironmentSave req) {
        ApiEnvironment e = environments.findById(id).orElseThrow(() -> new IllegalArgumentException("No such environment: " + id));
        applyEnv(e, req);
        return environments.save(e);
    }

    public void deleteEnvironment(Long id) {
        environments.deleteById(id);
    }

    private void applyEnv(ApiEnvironment e, EnvironmentSave req) {
        e.setName(req.name().trim());
        e.setVariablesJson(req.variablesJson() == null ? "{}" : req.variablesJson());
    }

    public List<ApiRequestDef> listRequests(Long collectionId) {
        return requests.findAllByCollectionIdOrderByNameAsc(collectionId);
    }

    public ApiRequestDef saveRequest(RequestSave req) {
        if (req.name() == null || req.name().isBlank()) throw new IllegalArgumentException("Request name can't be empty.");
        if (!collections.existsById(req.collectionId())) throw new IllegalArgumentException("No such collection: " + req.collectionId());
        ApiRequestDef r = new ApiRequestDef();
        apply(r, req);
        return requests.save(r);
    }

    public ApiRequestDef updateRequest(Long id, RequestSave req) {
        ApiRequestDef r = requests.findById(id).orElseThrow(() -> new IllegalArgumentException("No such request: " + id));
        apply(r, req);
        return requests.save(r);
    }

    public void deleteRequest(Long id) {
        requests.deleteById(id);
    }

    private void apply(ApiRequestDef r, RequestSave req) {
        r.setCollectionId(req.collectionId());
        r.setName(req.name().trim());
        r.setMethod(req.method() == null || req.method().isBlank() ? "GET" : req.method().trim().toUpperCase());
        r.setUrl(req.url() == null ? "" : req.url().trim());
        r.setHeadersJson(req.headersJson());
        r.setBody(req.body());
    }
}
