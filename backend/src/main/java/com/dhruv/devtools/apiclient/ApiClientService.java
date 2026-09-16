package com.dhruv.devtools.apiclient;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class ApiClientService {

    private final ApiCollectionRepository collections;
    private final ApiRequestDefRepository requests;

    public ApiClientService(ApiCollectionRepository collections, ApiRequestDefRepository requests) {
        this.collections = collections;
        this.requests = requests;
    }

    public record RequestSave(Long collectionId, String name, String method, String url, String headersJson, String body) {}

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
        collections.deleteById(id);
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
