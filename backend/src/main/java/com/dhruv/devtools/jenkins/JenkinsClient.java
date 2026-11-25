package com.dhruv.devtools.jenkins;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.stereotype.Component;

import javax.net.ssl.SSLContext;
import javax.net.ssl.TrustManager;
import javax.net.ssl.X509TrustManager;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.CookieManager;
import java.net.ProxySelector;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.cert.X509Certificate;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Consumer;

/**
 * Thin client over Jenkins' own REST surface — the same endpoints its UI uses:
 * <ul>
 *   <li>{@code api/json?tree=…} for folders, jobs, builds, queue items</li>
 *   <li>{@code buildWithParameters} / {@code build} to trigger (returns a queue item Location)</li>
 *   <li>{@code wfapi/describe} + {@code wfapi/pendingInputActions} (Pipeline Stage View plugin)
 *       for stages and the "Proceed / Abort" input steps</li>
 *   <li>{@code input/{id}/proceedEmpty|submit|abort} to promote or reject a paused pipeline</li>
 *   <li>{@code logText/progressiveText} for a live-tailing console</li>
 * </ul>
 * POSTs fetch a CSRF crumb first when the controller has a crumb issuer. Every client keeps its
 * own cookie jar, because Jenkins ties a crumb to the session that requested it.
 */
@Component
public class JenkinsClient {

    private static final Duration TIMEOUT = Duration.ofSeconds(20);
    private static final int MAX_LOG_CHUNK = 512 * 1024;

    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, HttpClient> clients = new ConcurrentHashMap<>();
    private final Map<String, Optional<String[]>> crumbs = new ConcurrentHashMap<>();

    public static class JenkinsException extends RuntimeException {
        private final int status;
        public JenkinsException(int status, String message) {
            super(message);
            this.status = status;
        }
        public int getStatus() { return status; }
    }

    // ------------------------------------------------------------------ url helpers

    /** "team/app/main" → "job/team/job/app/job/main/" — each segment URL-encoded. */
    public static String jobUrlPath(String jobPath) {
        if (jobPath == null || jobPath.isBlank()) return "";
        StringBuilder sb = new StringBuilder();
        for (String seg : jobPath.split("/")) {
            if (seg.isBlank() || seg.equals("job")) continue;
            sb.append("job/").append(URLEncoder.encode(seg, StandardCharsets.UTF_8).replace("+", "%20")).append('/');
        }
        return sb.toString();
    }

    private static String base(JenkinsServer s) {
        String b = s.getBaseUrl().trim();
        return b.endsWith("/") ? b : b + "/";
    }

    private String key(JenkinsServer s) {
        return s.getId() + ":" + s.getUpdatedAt();
    }

    private HttpClient client(JenkinsServer s) {
        return clients.computeIfAbsent(key(s), k -> {
            HttpClient.Builder b = HttpClient.newBuilder()
                    .connectTimeout(TIMEOUT)
                    .followRedirects(HttpClient.Redirect.NORMAL)
                    .cookieHandler(new CookieManager());
            ProxySelector ps = ProxySelector.getDefault();
            if (ps != null) b.proxy(ps);
            if (s.isTrustAllCerts()) b.sslContext(trustAll());
            return b.build();
        });
    }

    private static SSLContext trustAll() {
        try {
            TrustManager[] tm = {new X509TrustManager() {
                public void checkClientTrusted(X509Certificate[] c, String a) {}
                public void checkServerTrusted(X509Certificate[] c, String a) {}
                public X509Certificate[] getAcceptedIssuers() { return new X509Certificate[0]; }
            }};
            SSLContext ctx = SSLContext.getInstance("TLS");
            ctx.init(null, tm, new java.security.SecureRandom());
            return ctx;
        } catch (Exception e) {
            throw new IllegalStateException("Could not build a trust-all TLS context", e);
        }
    }

    /** tree=jobs[name]{0,30} — brackets/braces are illegal in a raw URI; Jenkins accepts them percent-encoded. */
    static String encodeQuery(String url) {
        int q = url.indexOf('?');
        if (q < 0) return url;
        StringBuilder sb = new StringBuilder(url.substring(0, q + 1));
        for (char c : url.substring(q + 1).toCharArray()) {
            switch (c) {
                case '[' -> sb.append("%5B");
                case ']' -> sb.append("%5D");
                case '{' -> sb.append("%7B");
                case '}' -> sb.append("%7D");
                case '|' -> sb.append("%7C");
                case ' ' -> sb.append("%20");
                default -> sb.append(c);
            }
        }
        return sb.toString();
    }

    private HttpRequest.Builder req(JenkinsServer s, String relative) {
        URI uri = URI.create(encodeQuery(relative.startsWith("http") ? relative : base(s) + relative));
        HttpRequest.Builder b = HttpRequest.newBuilder(uri).timeout(TIMEOUT);
        if (s.getUsername() != null && !s.getUsername().isBlank()) {
            String token = s.getApiToken() == null ? "" : s.getApiToken();
            String basic = Base64.getEncoder().encodeToString((s.getUsername() + ":" + token).getBytes(StandardCharsets.UTF_8));
            b.header("Authorization", "Basic " + basic);
        }
        return b;
    }

    private HttpResponse<String> send(JenkinsServer s, HttpRequest r) {
        try {
            return client(s).send(r, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new JenkinsException(502, "Could not reach Jenkins at " + s.getBaseUrl() + " — " + e.getClass().getSimpleName()
                    + (e.getMessage() == null ? "" : ": " + e.getMessage()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new JenkinsException(503, "Interrupted while calling Jenkins");
        }
    }

    private static String explain(int status, String what) {
        return switch (status) {
            case 401 -> "Jenkins rejected the credentials (401) while " + what + ". Check the username and API token.";
            case 403 -> "Jenkins refused access (403) while " + what + ". The user may lack the permission, or a CSRF crumb was rejected.";
            case 404 -> "Not found (404) while " + what + ". Check the job path / build number.";
            default -> "Jenkins answered HTTP " + status + " while " + what + ".";
        };
    }

    public JsonNode getJson(JenkinsServer s, String relative, String what) {
        HttpResponse<String> r = send(s, req(s, relative).header("Accept", "application/json").GET().build());
        if (r.statusCode() >= 400) throw new JenkinsException(r.statusCode(), explain(r.statusCode(), what));
        try {
            return mapper.readTree(r.body());
        } catch (IOException e) {
            throw new JenkinsException(502, "Jenkins returned something that isn't JSON while " + what
                    + " — is the base URL pointing at Jenkins itself (not a login/SSO page)?");
        }
    }

    private Optional<JsonNode> getJsonOptional(JenkinsServer s, String relative) {
        try {
            HttpResponse<String> r = send(s, req(s, relative).header("Accept", "application/json").GET().build());
            if (r.statusCode() >= 400) return Optional.empty();
            return Optional.of(mapper.readTree(r.body()));
        } catch (Exception e) {
            return Optional.empty();
        }
    }

    private Optional<String[]> crumb(JenkinsServer s) {
        return crumbs.computeIfAbsent(key(s), k -> getJsonOptional(s, "crumbIssuer/api/json")
                .filter(n -> n.hasNonNull("crumb"))
                .map(n -> new String[]{n.path("crumbRequestField").asText("Jenkins-Crumb"), n.get("crumb").asText()}));
    }

    private static String form(Map<String, String> params) {
        StringJoiner j = new StringJoiner("&");
        params.forEach((k, v) -> j.add(URLEncoder.encode(k, StandardCharsets.UTF_8) + "=" + URLEncoder.encode(v == null ? "" : v, StandardCharsets.UTF_8)));
        return j.toString();
    }

    public HttpResponse<String> post(JenkinsServer s, String relative, Map<String, String> formParams, String what) {
        for (int attempt = 0; attempt < 2; attempt++) {
            HttpRequest.Builder b = req(s, relative)
                    .header("Content-Type", "application/x-www-form-urlencoded")
                    .POST(HttpRequest.BodyPublishers.ofString(formParams == null ? "" : form(formParams)));
            crumb(s).ifPresent(c -> b.header(c[0], c[1]));
            HttpResponse<String> r = send(s, b.build());
            if (r.statusCode() == 403 && attempt == 0) {
                crumbs.remove(key(s)); // crumb expired with the session — fetch a fresh one once
                continue;
            }
            if (r.statusCode() >= 400) throw new JenkinsException(r.statusCode(), explain(r.statusCode(), what));
            return r;
        }
        throw new JenkinsException(403, explain(403, what));
    }

    // ------------------------------------------------------------------ operations

    public Map<String, Object> whoAmI(JenkinsServer s) {
        HttpResponse<String> r = send(s, req(s, "me/api/json").header("Accept", "application/json").GET().build());
        if (r.statusCode() >= 400) throw new JenkinsException(r.statusCode(), explain(r.statusCode(), "checking the connection"));
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("version", r.headers().firstValue("X-Jenkins").orElse("unknown"));
        try {
            JsonNode n = mapper.readTree(r.body());
            out.put("user", n.path("fullName").asText(n.path("id").asText("anonymous")));
        } catch (IOException e) {
            throw new JenkinsException(502, "That URL answered, but not like Jenkins does (no JSON from /me/api/json).");
        }
        return out;
    }

    public JsonNode listJobs(JenkinsServer s, String folderPath) {
        return getJson(s, jobUrlPath(folderPath)
                + "api/json?tree=name,url,_class,description,jobs[name,url,color,_class,description,lastBuild[number,result,timestamp,duration,building]]",
                "listing jobs");
    }

    public JsonNode jobDetail(JenkinsServer s, String jobPath) {
        return getJson(s, jobUrlPath(jobPath) + "api/json?tree=name,fullName,url,description,color,_class,buildable,nextBuildNumber,"
                + "property[parameterDefinitions[name,type,description,choices,defaultParameterValue[value]]],"
                + "lastSuccessfulBuild[number],lastFailedBuild[number],"
                + "builds[number,result,building,timestamp,duration,displayName,description]{0,30}",
                "reading the job");
    }

    /** Triggers a build and returns the queue item id Jenkins assigned (from the Location header). */
    public Map<String, Object> trigger(JenkinsServer s, String jobPath, Map<String, String> params, boolean parameterized) {
        String endpoint = jobUrlPath(jobPath) + ((parameterized || (params != null && !params.isEmpty())) ? "buildWithParameters" : "build");
        HttpResponse<String> r = post(s, endpoint, params == null ? Map.of() : params, "triggering " + jobPath);
        String location = r.headers().firstValue("Location").orElse("");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("queueUrl", location);
        Long queueId = null;
        java.util.regex.Matcher m = java.util.regex.Pattern.compile("/queue/item/(\\d+)").matcher(location);
        if (m.find()) queueId = Long.parseLong(m.group(1));
        out.put("queueId", queueId);
        return out;
    }

    public Map<String, Object> queueItem(JenkinsServer s, long queueId) {
        JsonNode n = getJson(s, "queue/item/" + queueId + "/api/json", "reading the queue item");
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("why", n.path("why").isNull() ? null : n.path("why").asText(null));
        out.put("cancelled", n.path("cancelled").asBoolean(false));
        JsonNode ex = n.path("executable");
        out.put("buildNumber", ex.hasNonNull("number") ? ex.get("number").asInt() : null);
        out.put("buildUrl", ex.hasNonNull("url") ? ex.get("url").asText() : null);
        return out;
    }

    /** Build status, plus stages and pending input steps when the Pipeline Stage View API is installed. */
    public ObjectNode build(JenkinsServer s, String jobPath, int number) {
        String b = jobUrlPath(jobPath) + number + "/";
        JsonNode core = getJson(s, b + "api/json?tree=number,url,result,building,duration,estimatedDuration,timestamp,displayName,"
                + "fullDisplayName,description,actions[parameters[name,value],causes[shortDescription,userName]],"
                + "artifacts[fileName,relativePath],changeSets[items[msg,commitId,author[fullName]]]", "reading build #" + number);
        ObjectNode out = mapper.createObjectNode();
        out.put("number", core.path("number").asInt(number));
        out.put("url", core.path("url").asText(""));
        out.set("result", core.get("result"));
        out.put("building", core.path("building").asBoolean(false));
        out.put("duration", core.path("duration").asLong(0));
        out.put("estimatedDuration", core.path("estimatedDuration").asLong(-1));
        out.put("timestamp", core.path("timestamp").asLong(0));
        out.put("displayName", core.path("displayName").asText("#" + number));
        out.set("description", core.get("description"));

        ArrayNode params = mapper.createArrayNode();
        ArrayNode causes = mapper.createArrayNode();
        for (JsonNode action : core.path("actions")) {
            for (JsonNode p : action.path("parameters")) {
                ObjectNode pn = params.addObject();
                pn.put("name", p.path("name").asText());
                pn.put("value", p.path("value").isValueNode() ? p.path("value").asText() : p.path("value").toString());
            }
            for (JsonNode c : action.path("causes")) causes.add(c.path("shortDescription").asText());
        }
        out.set("parameters", params);
        out.set("causes", causes);
        out.set("artifacts", core.path("artifacts").isMissingNode() ? mapper.createArrayNode() : core.get("artifacts"));
        ArrayNode changes = mapper.createArrayNode();
        for (JsonNode cs : core.path("changeSets")) {
            for (JsonNode item : cs.path("items")) {
                ObjectNode c = changes.addObject();
                c.put("msg", item.path("msg").asText());
                c.put("commitId", item.path("commitId").asText());
                c.put("author", item.path("author").path("fullName").asText());
            }
        }
        out.set("changes", changes);

        Optional<JsonNode> wf = getJsonOptional(s, b + "wfapi/describe");
        out.put("hasStageApi", wf.isPresent());
        ArrayNode stages = mapper.createArrayNode();
        wf.ifPresent(w -> {
            for (JsonNode st : w.path("stages")) {
                ObjectNode sn = stages.addObject();
                sn.put("id", st.path("id").asText());
                sn.put("name", st.path("name").asText());
                sn.put("status", st.path("status").asText("NOT_EXECUTED"));
                sn.put("durationMillis", st.path("durationMillis").asLong(0));
                sn.put("startTimeMillis", st.path("startTimeMillis").asLong(0));
                sn.put("pauseDurationMillis", st.path("pauseDurationMillis").asLong(0));
            }
        });
        out.set("stages", stages);

        ArrayNode inputs = mapper.createArrayNode();
        if (out.path("building").asBoolean()) {
            getJsonOptional(s, b + "wfapi/pendingInputActions").ifPresent(arr -> {
                for (JsonNode in : arr) {
                    ObjectNode i = inputs.addObject();
                    i.put("id", in.path("id").asText());
                    i.put("message", in.path("message").asText(""));
                    i.put("proceedText", in.path("proceedText").asText("Proceed"));
                    ArrayNode fields = i.putArray("inputs");
                    for (JsonNode f : in.path("inputs")) {
                        ObjectNode fn = fields.addObject();
                        fn.put("name", f.path("name").asText());
                        fn.put("type", f.path("type").asText("StringParameterDefinition"));
                        fn.put("description", f.path("description").asText(""));
                        JsonNode def = f.path("definition");
                        fn.set("choices", def.path("choices").isArray() ? def.get("choices") : mapper.createArrayNode());
                        JsonNode dv = def.path("defaultVal");
                        if (dv.isMissingNode()) dv = def.path("defaultValue");
                        if (dv.isMissingNode()) dv = def.path("defaultParameterValue").path("value");
                        fn.put("defaultValue", dv.isMissingNode() || dv.isNull() ? "" : dv.asText());
                    }
                }
            });
        }
        out.set("pendingInputs", inputs);
        return out;
    }

    public Map<String, Object> progressiveLog(JenkinsServer s, String jobPath, int number, long start) {
        String rel = jobUrlPath(jobPath) + number + "/logText/progressiveText?start=" + Math.max(0, start);
        HttpResponse<String> r = send(s, req(s, rel).GET().build());
        if (r.statusCode() >= 400) throw new JenkinsException(r.statusCode(), explain(r.statusCode(), "reading the console log"));
        String text = r.body();
        long next = r.headers().firstValue("X-Text-Size").map(Long::parseLong).orElse(start + text.length());
        boolean more = r.headers().firstValue("X-More-Data").map(Boolean::parseBoolean).orElse(false);
        boolean clipped = false;
        if (text.length() > MAX_LOG_CHUNK) {
            text = text.substring(text.length() - MAX_LOG_CHUNK);
            clipped = true;
        }
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("text", text);
        out.put("nextStart", next);
        out.put("more", more);
        out.put("clipped", clipped);
        return out;
    }

    /** Streams the whole console line-by-line (never buffered whole — CD logs can be huge). */
    public void streamConsole(JenkinsServer s, String jobPath, int number, Consumer<String> lineConsumer, long maxBytes) {
        HttpRequest r = req(s, jobUrlPath(jobPath) + number + "/consoleText").GET().build();
        try {
            HttpResponse<InputStream> resp = client(s).send(r, HttpResponse.BodyHandlers.ofInputStream());
            if (resp.statusCode() >= 400) {
                resp.body().close();
                throw new JenkinsException(resp.statusCode(), explain(resp.statusCode(), "reading the console log"));
            }
            long read = 0;
            try (BufferedReader br = new BufferedReader(new InputStreamReader(resp.body(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = br.readLine()) != null) {
                    lineConsumer.accept(line);
                    read += line.length() + 1;
                    if (read > maxBytes) break;
                }
            }
        } catch (IOException e) {
            throw new JenkinsException(502, "Could not read the console log: " + e.getMessage());
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new JenkinsException(503, "Interrupted while reading the console log");
        }
    }

    /** "Proceed" (optionally with input parameters) or "Abort" a paused input step. */
    public void input(JenkinsServer s, String jobPath, int number, String inputId, String action, Map<String, String> params) {
        String b = jobUrlPath(jobPath) + number + "/input/" + URLEncoder.encode(inputId, StandardCharsets.UTF_8) + "/";
        if ("abort".equalsIgnoreCase(action)) {
            post(s, b + "abort", Map.of(), "aborting input " + inputId);
            return;
        }
        if (params == null || params.isEmpty()) {
            post(s, b + "proceedEmpty", Map.of(), "proceeding input " + inputId);
            return;
        }
        ObjectNode json = mapper.createObjectNode();
        ArrayNode arr = json.putArray("parameter");
        params.forEach((k, v) -> arr.addObject().put("name", k).put("value", v));
        Map<String, String> form = new LinkedHashMap<>();
        form.put("json", json.toString());
        form.put("proceed", "Proceed");
        post(s, b + "submit", form, "submitting input " + inputId);
    }

    public void stop(JenkinsServer s, String jobPath, int number) {
        post(s, jobUrlPath(jobPath) + number + "/stop", Map.of(), "stopping build #" + number);
    }
}
