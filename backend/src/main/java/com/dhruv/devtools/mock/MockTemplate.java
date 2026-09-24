package com.dhruv.devtools.mock;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ThreadLocalRandom;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Tiny {{placeholder}} expander for mock responses — enough to make a static mock feel dynamic
 * (echo the id you asked for, stamp a fresh UUID) without pulling in a full template engine.
 *
 * Supported: {{path.name}}, {{query.name}}, {{header.Name}}, {{body}}, {{body.a.b.0.c}} (JSON
 * pointer-ish walk into a JSON request body), {{method}}, {{uuid}}, {{now}} (ISO-8601),
 * {{epoch}} / {{epochMs}}, {{randomInt}} / {{randomInt 1 100}}. Unknown placeholders are left as-is
 * so a typo is visible in the response instead of silently vanishing.
 */
final class MockTemplate {

    private static final Pattern TOKEN = Pattern.compile("\\{\\{\\s*([^}]+?)\\s*}}");
    private static final ObjectMapper MAPPER = new ObjectMapper();

    record Context(String method, Map<String, String> path, Map<String, String[]> query, Map<String, String> headers, String body) {}

    private MockTemplate() {}

    static String render(String template, Context ctx) {
        if (template == null || template.indexOf("{{") < 0) return template;
        JsonNode[] bodyJson = new JsonNode[1];
        Matcher m = TOKEN.matcher(template);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String value = resolve(m.group(1).trim(), ctx, bodyJson);
            m.appendReplacement(out, Matcher.quoteReplacement(value != null ? value : m.group()));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static String resolve(String expr, Context ctx, JsonNode[] bodyJson) {
        String[] parts = expr.split("\\s+");
        String head = parts[0];
        switch (head) {
            case "uuid": return UUID.randomUUID().toString();
            case "now": return Instant.now().toString();
            case "epoch": return String.valueOf(Instant.now().getEpochSecond());
            case "epochMs": return String.valueOf(System.currentTimeMillis());
            case "method": return ctx.method();
            case "body": return ctx.body() == null ? "" : ctx.body();
            case "randomInt": {
                int lo = parts.length > 1 ? parseInt(parts[1], 0) : 0;
                int hi = parts.length > 2 ? parseInt(parts[2], 1000) : 1000;
                if (hi < lo) { int t = lo; lo = hi; hi = t; }
                return String.valueOf(ThreadLocalRandom.current().nextLong(lo, (long) hi + 1));
            }
            default: break;
        }
        int dot = head.indexOf('.');
        if (dot < 0) return null;
        String scope = head.substring(0, dot);
        String key = head.substring(dot + 1);
        switch (scope) {
            case "path": return ctx.path().get(key);
            case "query": {
                String[] v = ctx.query().get(key);
                return v == null || v.length == 0 ? "" : v[0];
            }
            case "header": {
                for (var e : ctx.headers().entrySet()) if (e.getKey().equalsIgnoreCase(key)) return e.getValue();
                return "";
            }
            case "body": {
                if (bodyJson[0] == null) {
                    try {
                        bodyJson[0] = MAPPER.readTree(ctx.body() == null || ctx.body().isBlank() ? "null" : ctx.body());
                    } catch (Exception e) {
                        return "";
                    }
                }
                JsonNode node = bodyJson[0];
                for (String seg : key.split("\\.")) {
                    if (node == null) break;
                    node = node.isArray() && seg.matches("\\d+") ? node.get(Integer.parseInt(seg)) : node.get(seg);
                }
                if (node == null || node.isNull() || node.isMissingNode()) return "";
                return node.isValueNode() ? node.asText() : node.toString();
            }
            default: return null;
        }
    }

    private static int parseInt(String s, int fallback) {
        try {
            return Integer.parseInt(s);
        } catch (NumberFormatException e) {
            return fallback;
        }
    }
}
