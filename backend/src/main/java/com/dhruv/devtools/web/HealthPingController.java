package com.dhruv.devtools.web;

import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.net.ProxySelector;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;

/**
 * Environment Health Board backend: pings a list of URLs (actuator/health, status pages…) in
 * parallel, server-side so CORS never gets in the way. GET only, 8s timeout, 4KB body preview.
 */
@RestController
@RequestMapping("/api/health-ping")
public class HealthPingController {

    private static final int MAX_TARGETS = 100;
    private static final int PREVIEW = 4096;
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(6))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .proxy(ProxySelector.getDefault())
            .build();
    private final ExecutorService pool = Executors.newFixedThreadPool(16, r -> {
        Thread t = new Thread(r, "health-ping");
        t.setDaemon(true);
        return t;
    });

    public record Target(String id, String url) {}
    public record PingRequest(List<Target> targets) {}
    public record PingResult(String id, String url, Integer status, long ms, String body, String error) {}

    @PostMapping
    public List<PingResult> ping(@RequestBody PingRequest req) throws InterruptedException {
        List<Target> targets = req.targets() == null ? List.of() : req.targets();
        if (targets.size() > MAX_TARGETS) throw new IllegalArgumentException("At most " + MAX_TARGETS + " URLs per run");
        List<Callable<PingResult>> jobs = new ArrayList<>();
        for (Target t : targets) jobs.add(() -> one(t));
        List<PingResult> out = new ArrayList<>();
        for (Future<PingResult> f : pool.invokeAll(jobs, 20, TimeUnit.SECONDS)) {
            try {
                out.add(f.get());
            } catch (CancellationException | ExecutionException e) {
                out.add(new PingResult(null, null, null, 20000, null, "Timed out"));
            }
        }
        return out;
    }

    private PingResult one(Target t) {
        long start = System.nanoTime();
        try {
            URI uri = URI.create(t.url().trim());
            if (!"http".equalsIgnoreCase(uri.getScheme()) && !"https".equalsIgnoreCase(uri.getScheme()))
                return new PingResult(t.id(), t.url(), null, 0, null, "Only http(s) URLs can be pinged");
            HttpRequest r = HttpRequest.newBuilder(uri).timeout(Duration.ofSeconds(8)).header("Accept", "application/json, */*").GET().build();
            HttpResponse<String> res = client.send(r, HttpResponse.BodyHandlers.ofString());
            String body = res.body();
            long ms = (System.nanoTime() - start) / 1_000_000;
            return new PingResult(t.id(), t.url(), res.statusCode(), ms, body.length() > PREVIEW ? body.substring(0, PREVIEW) : body, null);
        } catch (Exception e) {
            long ms = (System.nanoTime() - start) / 1_000_000;
            return new PingResult(t.id(), t.url(), null, ms, null, e.getClass().getSimpleName() + (e.getMessage() == null ? "" : ": " + e.getMessage()));
        }
    }
}
