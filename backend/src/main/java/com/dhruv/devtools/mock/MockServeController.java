package com.dhruv.devtools.mock;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.*;

/**
 * Serves configured mock routes under /mock/** — separate from /api/** so it never collides with
 * the app's own endpoints. This is the one path prefix reachable from other devices on the network
 * (see LanAccessFilter), and it answers CORS preflights (see MockCorsFilter), so a phone, a
 * teammate's laptop, or a frontend dev server on another origin can all call it directly.
 */
@RestController
public class MockServeController {

    private final MockRouteService service;
    private final MockRequestLog requestLog;

    public MockServeController(MockRouteService service, MockRequestLog requestLog) {
        this.service = service;
        this.requestLog = requestLog;
    }

    @RequestMapping("/mock/**")
    public ResponseEntity<String> serve(HttpServletRequest request) throws IOException {
        long started = System.nanoTime();
        String fullPath = request.getRequestURI().substring(request.getContextPath().length());
        String rawSubPath = fullPath.substring(fullPath.indexOf("/mock") + "/mock".length());
        final String subPath = rawSubPath.isEmpty() ? "/" : URLDecoder.decode(rawSubPath, StandardCharsets.UTF_8);
        String body = readBody(request);
        String method = request.getMethod();

        Optional<MockRouteService.Match> match = service.match(method, subPath);
        ResponseEntity<String> response = match
                .map(m -> respond(m, request, body))
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"No mock route matches " + jsonEscape(method + " " + subPath) + "\"}"));

        Long routeId = match.map(m -> m.route().getId()).orElse(null);
        requestLog.add(method, subPath, request.getQueryString(), request.getRemoteAddr(), request.getHeader("User-Agent"),
                request.getHeader("Origin"), routeId, response.getStatusCode().value(),
                (System.nanoTime() - started) / 1_000_000, body);
        return response;
    }

    private ResponseEntity<String> respond(MockRouteService.Match match, HttpServletRequest request, String body) {
        MockRoute route = match.route();
        if (route.getDelayMs() > 0) {
            try {
                Thread.sleep(route.getDelayMs());
            } catch (InterruptedException ignored) {
                Thread.currentThread().interrupt();
            }
        }

        MockTemplate.Context ctx = route.isTemplated()
                ? new MockTemplate.Context(request.getMethod(), match.pathParams(), parseQuery(request.getQueryString()), headerMap(request), body)
                : null;
        String responseBody = route.getResponseBody() == null ? "" : route.getResponseBody();
        if (ctx != null) responseBody = MockTemplate.render(responseBody, ctx);

        MediaType contentType;
        try {
            contentType = MediaType.parseMediaType(route.getContentType());
        } catch (Exception e) {
            contentType = MediaType.TEXT_PLAIN;
        }

        ResponseEntity.BodyBuilder builder = ResponseEntity.status(route.getStatus()).contentType(contentType);
        Map<String, String> custom = service.headersOf(route);
        for (var h : custom.entrySet()) {
            String value = ctx != null ? MockTemplate.render(h.getValue(), ctx) : h.getValue();
            builder.header(h.getKey(), value);
        }
        builder.header("X-Mock-Route", String.valueOf(route.getId()));
        if (request.getHeader("Origin") != null) {
            // Cross-origin JS can only read response headers that are explicitly exposed.
            List<String> exposed = new ArrayList<>(custom.keySet());
            exposed.add("X-Mock-Route");
            builder.header("Access-Control-Expose-Headers", String.join(", ", exposed));
        }
        return builder.body(responseBody);
    }

    private String readBody(HttpServletRequest request) throws IOException {
        if (request.getContentLengthLong() == 0) return null;
        byte[] bytes = request.getInputStream().readNBytes(2 * 1024 * 1024);
        if (bytes.length == 0) return null;
        return new String(bytes, request.getCharacterEncoding() != null ? java.nio.charset.Charset.forName(request.getCharacterEncoding()) : StandardCharsets.UTF_8);
    }

    private Map<String, String[]> parseQuery(String query) {
        Map<String, List<String>> tmp = new LinkedHashMap<>();
        if (query != null) {
            for (String pair : query.split("&")) {
                if (pair.isEmpty()) continue;
                int eq = pair.indexOf('=');
                String k = URLDecoder.decode(eq < 0 ? pair : pair.substring(0, eq), StandardCharsets.UTF_8);
                String v = eq < 0 ? "" : URLDecoder.decode(pair.substring(eq + 1), StandardCharsets.UTF_8);
                tmp.computeIfAbsent(k, x -> new ArrayList<>()).add(v);
            }
        }
        Map<String, String[]> out = new LinkedHashMap<>();
        tmp.forEach((k, v) -> out.put(k, v.toArray(String[]::new)));
        return out;
    }

    private Map<String, String> headerMap(HttpServletRequest request) {
        Map<String, String> out = new LinkedHashMap<>();
        for (Enumeration<String> names = request.getHeaderNames(); names.hasMoreElements(); ) {
            String n = names.nextElement();
            out.put(n, request.getHeader(n));
        }
        return out;
    }

    private static String jsonEscape(String s) {
        return s.replace("\\", "\\\\").replace("\"", "\\\"");
    }
}
