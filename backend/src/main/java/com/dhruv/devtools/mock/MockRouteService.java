package com.dhruv.devtools.mock;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.*;

@Service
public class MockRouteService {

    private static final Set<String> METHODS = Set.of("GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS", "ANY");

    private final MockRouteRepository repository;
    private final ObjectMapper mapper = new ObjectMapper();

    public MockRouteService(MockRouteRepository repository) {
        this.repository = repository;
    }

    public record RouteSave(String method, String path, int status, String responseBody, String contentType, int delayMs,
                            boolean enabled, String headersJson, Boolean templated) {}

    /** A matched route plus the {name} captures pulled out of the request path. */
    public record Match(MockRoute route, Map<String, String> pathParams) {}

    public List<MockRoute> list() {
        return repository.findAllByOrderByPathAsc();
    }

    public MockRoute create(RouteSave req) {
        validate(req);
        MockRoute r = new MockRoute();
        apply(r, req);
        return repository.save(r);
    }

    public MockRoute update(Long id, RouteSave req) {
        validate(req);
        MockRoute r = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such mock route: " + id));
        apply(r, req);
        return repository.save(r);
    }

    public void delete(Long id) {
        repository.deleteById(id);
    }

    /** Bulk import (e.g. from an exported JSON file). Returns how many routes were created. */
    @Transactional
    public int importAll(List<RouteSave> routes, boolean replace) {
        if (routes == null) return 0;
        routes.forEach(this::validate);
        if (replace) repository.deleteAll();
        for (RouteSave req : routes) {
            MockRoute r = new MockRoute();
            apply(r, req);
            repository.save(r);
        }
        return routes.size();
    }

    /**
     * The most specific enabled route wins, so overlapping patterns behave predictably:
     * more literal segments beat {params}/* wildcards, a trailing ** catch-all loses to anything
     * more precise, and on an otherwise equal pattern an exact method beats ANY.
     */
    public Optional<Match> match(String method, String requestPath) {
        String[] actual = segments(requestPath);
        Match best = null;
        int bestScore = Integer.MIN_VALUE;
        for (MockRoute r : repository.findAllByEnabledTrue()) {
            boolean anyMethod = r.getMethod().equalsIgnoreCase("ANY");
            if (!anyMethod && !r.getMethod().equalsIgnoreCase(method)) continue;
            Map<String, String> params = new LinkedHashMap<>();
            Integer score = score(segments(r.getPath()), actual, params);
            if (score == null) continue;
            score = score * 2 + (anyMethod ? 0 : 1);
            if (score > bestScore) {
                bestScore = score;
                best = new Match(r, params);
            }
        }
        return Optional.ofNullable(best);
    }

    /** Null when the pattern doesn't match; otherwise higher = more specific. */
    private Integer score(String[] pattern, String[] actual, Map<String, String> params) {
        int score = 0;
        for (int i = 0; i < pattern.length; i++) {
            String p = pattern[i];
            if (p.equals("**")) {
                if (i != pattern.length - 1) return null; // ** only supported as the last segment
                params.put("rest", String.join("/", Arrays.copyOfRange(actual, Math.min(i, actual.length), actual.length)));
                return score - 1000;
            }
            if (i >= actual.length) return null;
            if (p.startsWith("{") && p.endsWith("}")) {
                params.put(p.substring(1, p.length() - 1), actual[i]);
                score += 1;
            } else if (p.equals("*")) {
                score += 1;
            } else if (p.equals(actual[i])) {
                score += 10;
            } else {
                return null;
            }
        }
        return pattern.length == actual.length ? score : null;
    }

    private String[] segments(String path) {
        String t = path == null ? "" : path.trim();
        int q = t.indexOf('?');
        if (q >= 0) t = t.substring(0, q);
        return Arrays.stream(t.split("/")).filter(s -> !s.isEmpty()).toArray(String[]::new);
    }

    public Map<String, String> headersOf(MockRoute r) {
        if (r.getHeadersJson() == null || r.getHeadersJson().isBlank()) return Map.of();
        try {
            return mapper.readValue(r.getHeadersJson(), new TypeReference<LinkedHashMap<String, String>>() {});
        } catch (Exception e) {
            return Map.of();
        }
    }

    private void validate(RouteSave req) {
        if (req.path() == null || req.path().isBlank()) throw new IllegalArgumentException("Path can't be empty.");
        if (req.method() == null || req.method().isBlank()) throw new IllegalArgumentException("Method can't be empty.");
        if (!METHODS.contains(req.method().trim().toUpperCase())) throw new IllegalArgumentException("Unsupported method: " + req.method());
        if (req.status() != 0 && (req.status() < 100 || req.status() > 599)) throw new IllegalArgumentException("Status must be between 100 and 599.");
        if (req.headersJson() != null && !req.headersJson().isBlank()) {
            try {
                mapper.readValue(req.headersJson(), new TypeReference<LinkedHashMap<String, String>>() {});
            } catch (Exception e) {
                throw new IllegalArgumentException("Response headers must be a flat JSON object of strings, e.g. {\"X-Id\": \"1\"}.");
            }
        }
    }

    private void apply(MockRoute r, RouteSave req) {
        r.setMethod(req.method().trim().toUpperCase());
        String path = req.path().trim();
        r.setPath(path.startsWith("/") ? path : "/" + path);
        r.setStatus(req.status() <= 0 ? 200 : req.status());
        r.setResponseBody(req.responseBody());
        r.setContentType(req.contentType() == null || req.contentType().isBlank() ? "application/json" : req.contentType().trim());
        r.setDelayMs(Math.max(0, Math.min(req.delayMs(), 60_000)));
        r.setEnabled(req.enabled());
        r.setHeadersJson(req.headersJson() == null || req.headersJson().isBlank() ? null : req.headersJson().trim());
        r.setTemplated(req.templated() == null || req.templated());
    }
}
