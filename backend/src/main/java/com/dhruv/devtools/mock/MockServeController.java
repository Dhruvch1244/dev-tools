package com.dhruv.devtools.mock;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Serves configured mock routes under /mock/** — separate from /api/** so it never collides with the app's own endpoints. */
@RestController
public class MockServeController {

    private final MockRouteService service;

    public MockServeController(MockRouteService service) {
        this.service = service;
    }

    @RequestMapping("/mock/**")
    public ResponseEntity<String> serve(HttpServletRequest request) throws InterruptedException {
        String fullPath = request.getRequestURI();
        String rawSubPath = fullPath.substring(fullPath.indexOf("/mock") + "/mock".length());
        final String subPath = rawSubPath.isEmpty() ? "/" : rawSubPath;

        return service.match(request.getMethod(), subPath)
                .map(route -> {
                    if (route.getDelayMs() > 0) {
                        try {
                            Thread.sleep(route.getDelayMs());
                        } catch (InterruptedException ignored) {
                            Thread.currentThread().interrupt();
                        }
                    }
                    return ResponseEntity.status(route.getStatus())
                            .contentType(MediaType.parseMediaType(route.getContentType()))
                            .body(route.getResponseBody() == null ? "" : route.getResponseBody());
                })
                .orElseGet(() -> ResponseEntity.status(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":\"No mock route matches " + request.getMethod() + " " + subPath + "\"}"));
    }
}
