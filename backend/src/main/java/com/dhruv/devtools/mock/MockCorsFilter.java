package com.dhruv.devtools.mock;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

/**
 * Permissive CORS for /mock/** only: a mock API is meant to be called from whatever frontend
 * you're building, on whatever origin/device it runs. Preflights are answered here directly —
 * Spring MVC's own CORS handling would otherwise reject them, since no @CrossOrigin config
 * exists for the catch-all mock handler. The app's own /api/** gets none of this.
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE + 10)
public class MockCorsFilter extends OncePerRequestFilter {

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return !(path.equals("/mock") || path.startsWith("/mock/"));
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        String origin = request.getHeader("Origin");
        if (origin != null) {
            // Echo the origin (rather than "*") so requests sent with credentials/cookies still work.
            response.setHeader("Access-Control-Allow-Origin", origin);
            response.setHeader("Access-Control-Allow-Credentials", "true");
            response.addHeader("Vary", "Origin");
        }

        boolean preflight = "OPTIONS".equalsIgnoreCase(request.getMethod())
                && origin != null
                && request.getHeader("Access-Control-Request-Method") != null;
        if (preflight) {
            response.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, PATCH, DELETE, HEAD, OPTIONS");
            String requested = request.getHeader("Access-Control-Request-Headers");
            response.setHeader("Access-Control-Allow-Headers", requested != null && !requested.isBlank() ? requested : "*");
            response.setHeader("Access-Control-Max-Age", "600");
            if (request.getHeader("Access-Control-Request-Private-Network") != null) {
                response.setHeader("Access-Control-Allow-Private-Network", "true");
            }
            response.setStatus(HttpServletResponse.SC_NO_CONTENT);
            return;
        }
        chain.doFilter(request, response);
    }
}
