package com.dhruv.devtools.mock;

import org.springframework.stereotype.Service;

import java.util.List;
import java.util.Optional;

@Service
public class MockRouteService {

    private final MockRouteRepository repository;

    public MockRouteService(MockRouteRepository repository) {
        this.repository = repository;
    }

    public record RouteSave(String method, String path, int status, String responseBody, String contentType, int delayMs, boolean enabled) {}

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

    /** First enabled route whose method+path pattern matches, in no particular priority order — keep patterns non-overlapping for predictable results. */
    public Optional<MockRoute> match(String method, String requestPath) {
        return repository.findAllByEnabledTrue().stream()
                .filter(r -> r.getMethod().equalsIgnoreCase("ANY") || r.getMethod().equalsIgnoreCase(method))
                .filter(r -> pathMatches(r.getPath(), requestPath))
                .findFirst();
    }

    private boolean pathMatches(String pattern, String actual) {
        String[] p = trimSlashes(pattern).split("/");
        String[] a = trimSlashes(actual).split("/");
        if (p.length != a.length) return false;
        for (int i = 0; i < p.length; i++) {
            if (p[i].startsWith("{") && p[i].endsWith("}")) continue;
            if (!p[i].equals(a[i])) return false;
        }
        return true;
    }

    private String trimSlashes(String s) {
        String t = s.startsWith("/") ? s.substring(1) : s;
        return t.endsWith("/") && t.length() > 1 ? t.substring(0, t.length() - 1) : t;
    }

    private void validate(RouteSave req) {
        if (req.path() == null || req.path().isBlank()) throw new IllegalArgumentException("Path can't be empty.");
        if (req.method() == null || req.method().isBlank()) throw new IllegalArgumentException("Method can't be empty.");
    }

    private void apply(MockRoute r, RouteSave req) {
        r.setMethod(req.method().trim().toUpperCase());
        r.setPath(req.path().trim());
        r.setStatus(req.status() <= 0 ? 200 : req.status());
        r.setResponseBody(req.responseBody());
        r.setContentType(req.contentType() == null || req.contentType().isBlank() ? "application/json" : req.contentType().trim());
        r.setDelayMs(Math.max(0, req.delayMs()));
        r.setEnabled(req.enabled());
    }
}
