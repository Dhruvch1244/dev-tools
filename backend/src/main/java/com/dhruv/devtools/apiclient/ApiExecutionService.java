package com.dhruv.devtools.apiclient;

import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/** Executes arbitrary HTTP requests server-side — the whole point of a local API client is to not be bound by browser CORS. */
@Service
public class ApiExecutionService {

    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();

    public record HeaderKV(String key, String value) {}

    public record ExecuteRequest(String method, String url, List<HeaderKV> headers, String body) {}

    public record ExecuteResponse(int status, String statusText, Map<String, String> headers, String body, long durationMs, long bodyBytes) {}

    public ExecuteResponse execute(ExecuteRequest req) {
        if (req.url() == null || req.url().isBlank()) throw new IllegalArgumentException("URL can't be empty.");
        String method = req.method() == null || req.method().isBlank() ? "GET" : req.method().trim().toUpperCase();

        HttpRequest.Builder builder;
        try {
            builder = HttpRequest.newBuilder(URI.create(req.url().trim())).timeout(Duration.ofSeconds(30));
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("Invalid URL: " + e.getMessage());
        }

        boolean hasBody = req.body() != null && !req.body().isEmpty() && !isBodylessMethod(method);
        HttpRequest.BodyPublisher publisher = hasBody
                ? HttpRequest.BodyPublishers.ofString(req.body())
                : HttpRequest.BodyPublishers.noBody();
        builder.method(method, publisher);

        if (req.headers() != null) {
            for (HeaderKV h : req.headers()) {
                if (h.key() == null || h.key().isBlank()) continue;
                try {
                    builder.header(h.key().trim(), h.value() == null ? "" : h.value());
                } catch (IllegalArgumentException ignored) {
                    // restricted header (e.g. Host, Content-Length) — HttpClient refuses to set these directly, safe to skip
                }
            }
        }

        long start = System.nanoTime();
        try {
            HttpResponse<String> response = CLIENT.send(builder.build(), HttpResponse.BodyHandlers.ofString());
            long durationMs = (System.nanoTime() - start) / 1_000_000;
            Map<String, String> headers = new LinkedHashMap<>();
            response.headers().map().forEach((k, v) -> headers.put(k, String.join(", ", v)));
            String body = response.body() == null ? "" : response.body();
            return new ExecuteResponse(response.statusCode(), statusTextFor(response.statusCode()), headers, body, durationMs, body.getBytes().length);
        } catch (IOException e) {
            throw new IllegalArgumentException("Request failed: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new IllegalArgumentException("Request interrupted.");
        }
    }

    private boolean isBodylessMethod(String method) {
        return method.equals("GET") || method.equals("HEAD");
    }

    private String statusTextFor(int status) {
        return switch (status) {
            case 200 -> "OK";
            case 201 -> "Created";
            case 202 -> "Accepted";
            case 204 -> "No Content";
            case 301 -> "Moved Permanently";
            case 302 -> "Found";
            case 304 -> "Not Modified";
            case 400 -> "Bad Request";
            case 401 -> "Unauthorized";
            case 403 -> "Forbidden";
            case 404 -> "Not Found";
            case 405 -> "Method Not Allowed";
            case 409 -> "Conflict";
            case 422 -> "Unprocessable Entity";
            case 429 -> "Too Many Requests";
            case 500 -> "Internal Server Error";
            case 502 -> "Bad Gateway";
            case 503 -> "Service Unavailable";
            case 504 -> "Gateway Timeout";
            default -> "";
        };
    }
}
