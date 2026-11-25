package com.dhruv.devtools.jenkins;

import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.core.env.Environment;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.*;

/**
 * Jenkins Pipeline Studio backend: proxies Jenkins' REST API (browsers can't call it directly —
 * CORS, and the API token must not live in page JS), stores servers, captured Helm tags and the
 * frontend's release-flow / rehydration-snapshot documents.
 */
@RestController
@RequestMapping("/api/jenkins")
public class JenkinsController {

    private final JenkinsServerRepository servers;
    private final HelmTagRecordRepository records;
    private final JsonDocRepository docs;
    private final JenkinsClient client;
    private final Environment env;

    public JenkinsController(JenkinsServerRepository servers, HelmTagRecordRepository records, JsonDocRepository docs,
                             JenkinsClient client, Environment env) {
        this.servers = servers;
        this.records = records;
        this.docs = docs;
        this.client = client;
        this.env = env;
    }

    @ExceptionHandler(JenkinsClient.JenkinsException.class)
    public ResponseEntity<Map<String, String>> jenkinsError(JenkinsClient.JenkinsException e) {
        // 401/403/404 from Jenkins are reported as 502 so the UI never mistakes them for its own auth
        int status = e.getStatus() == 503 ? 503 : 502;
        return ResponseEntity.status(status).body(Map.of("error", e.getMessage(), "jenkinsStatus", String.valueOf(e.getStatus())));
    }

    private JenkinsServer server(Long id) {
        return servers.findById(id).orElseThrow(() -> new IllegalArgumentException("No Jenkins server with id " + id));
    }

    // ------------------------------------------------------------------ servers

    public record ServerRequest(String name, String baseUrl, String username, String apiToken, Boolean trustAllCerts) {}

    @GetMapping("/servers")
    public List<JenkinsServer> listServers() {
        return servers.findAll();
    }

    @PostMapping("/servers")
    public JenkinsServer createServer(@RequestBody ServerRequest req) {
        JenkinsServer s = new JenkinsServer();
        apply(s, req);
        return servers.save(s);
    }

    @PutMapping("/servers/{id}")
    public JenkinsServer updateServer(@PathVariable Long id, @RequestBody ServerRequest req) {
        JenkinsServer s = server(id);
        apply(s, req);
        return servers.save(s);
    }

    private static void apply(JenkinsServer s, ServerRequest req) {
        if (req.name() == null || req.name().isBlank()) throw new IllegalArgumentException("Give the server a name");
        if (req.baseUrl() == null || !req.baseUrl().trim().matches("(?i)https?://.+"))
            throw new IllegalArgumentException("Base URL must start with http:// or https://");
        s.setName(req.name().trim());
        s.setBaseUrl(req.baseUrl().trim().replaceAll("/+$", ""));
        s.setUsername(req.username() == null ? null : req.username().trim());
        // blank token on update = keep the stored one (the UI never receives it back to resend)
        if (req.apiToken() != null && !req.apiToken().isBlank()) s.setApiToken(req.apiToken().trim());
        s.setTrustAllCerts(Boolean.TRUE.equals(req.trustAllCerts()));
    }

    @DeleteMapping("/servers/{id}")
    public void deleteServer(@PathVariable Long id) {
        servers.deleteById(id);
    }

    /** Adds the built-in simulated Jenkins (served by this app at /demo-jenkins) to try every feature safely. */
    @PostMapping("/servers/demo")
    public JenkinsServer createDemo() {
        String port = env.getProperty("local.server.port", env.getProperty("server.port", "8383"));
        String url = "http://127.0.0.1:" + port + "/demo-jenkins";
        return servers.findAll().stream().filter(JenkinsServer::isDemo).findFirst().map(existing -> {
            existing.setBaseUrl(url);
            return servers.save(existing);
        }).orElseGet(() -> {
            JenkinsServer s = new JenkinsServer();
            s.setName("Demo Jenkins (simulated)");
            s.setBaseUrl(url);
            s.setUsername("demo");
            s.setApiToken("demo-token");
            s.setDemo(true);
            return servers.save(s);
        });
    }

    @PostMapping("/servers/{id}/test")
    public Map<String, Object> test(@PathVariable Long id) {
        return client.whoAmI(server(id));
    }

    // ------------------------------------------------------------------ jobs & builds

    @GetMapping("/servers/{id}/jobs")
    public JsonNode jobs(@PathVariable Long id, @RequestParam(defaultValue = "") String path) {
        return client.listJobs(server(id), path);
    }

    @GetMapping("/servers/{id}/job")
    public JsonNode job(@PathVariable Long id, @RequestParam String path) {
        return client.jobDetail(server(id), path);
    }

    public record TriggerRequest(String path, Map<String, String> params, Boolean parameterized) {}

    @PostMapping("/servers/{id}/trigger")
    public Map<String, Object> trigger(@PathVariable Long id, @RequestBody TriggerRequest req) {
        if (req.path() == null || req.path().isBlank()) throw new IllegalArgumentException("Job path is required");
        return client.trigger(server(id), req.path(), req.params(), Boolean.TRUE.equals(req.parameterized()));
    }

    @GetMapping("/servers/{id}/queue/{queueId}")
    public Map<String, Object> queue(@PathVariable Long id, @PathVariable long queueId) {
        return client.queueItem(server(id), queueId);
    }

    @GetMapping("/servers/{id}/build")
    public JsonNode build(@PathVariable Long id, @RequestParam String path, @RequestParam int number) {
        return client.build(server(id), path, number);
    }

    @GetMapping("/servers/{id}/log")
    public Map<String, Object> log(@PathVariable Long id, @RequestParam String path, @RequestParam int number,
                                   @RequestParam(defaultValue = "0") long start) {
        return client.progressiveLog(server(id), path, number, start);
    }

    public record InputRequest(String path, int number, String inputId, String action, Map<String, String> params) {}

    @PostMapping("/servers/{id}/input")
    public Map<String, Object> input(@PathVariable Long id, @RequestBody InputRequest req) {
        if (req.inputId() == null || req.inputId().isBlank()) throw new IllegalArgumentException("inputId is required");
        client.input(server(id), req.path(), req.number(), req.inputId(), req.action() == null ? "proceed" : req.action(), req.params());
        return Map.of("ok", true);
    }

    public record BuildRef(String path, int number) {}

    @PostMapping("/servers/{id}/stop")
    public Map<String, Object> stop(@PathVariable Long id, @RequestBody BuildRef req) {
        client.stop(server(id), req.path(), req.number());
        return Map.of("ok", true);
    }

    // ------------------------------------------------------------------ helm tag extraction

    public record ExtractRequest(String path, int number, List<HelmTagExtractor.PatternDef> patterns) {}

    @GetMapping("/helm-patterns/defaults")
    public List<HelmTagExtractor.PatternDef> defaultPatterns() {
        return HelmTagExtractor.DEFAULT_PATTERNS;
    }

    @PostMapping("/servers/{id}/helm-tag")
    public HelmTagExtractor.Result extract(@PathVariable Long id, @RequestBody ExtractRequest req) {
        JenkinsServer s = server(id);
        HelmTagExtractor ex = new HelmTagExtractor(req.patterns());
        JsonNode b = client.build(s, req.path(), req.number());
        Map<String, String> params = new LinkedHashMap<>();
        for (JsonNode p : b.path("parameters")) params.put(p.path("name").asText(), p.path("value").asText());
        client.streamConsole(s, req.path(), req.number(), ex::line, 200L * 1024 * 1024);
        ex.parameters(params);
        ex.text("build description", b.path("description").asText(null));
        ex.text("build display name", b.path("displayName").asText(null));
        return ex.result();
    }

    /** Same extraction over pasted console text — for logs copied out of Jenkins by hand. */
    public record ExtractTextRequest(String text, List<HelmTagExtractor.PatternDef> patterns) {}

    @PostMapping("/helm-tag/from-text")
    public HelmTagExtractor.Result extractFromText(@RequestBody ExtractTextRequest req) {
        HelmTagExtractor ex = new HelmTagExtractor(req.patterns());
        if (req.text() != null) req.text().lines().forEach(ex::line);
        return ex.result();
    }

    // ------------------------------------------------------------------ helm tag records

    @GetMapping("/records")
    public List<HelmTagRecord> listRecords() {
        return records.findAllByOrderByCapturedAtDesc();
    }

    @PostMapping("/records")
    public HelmTagRecord createRecord(@RequestBody HelmTagRecord r) {
        if (r.getService() == null || r.getService().isBlank()) throw new IllegalArgumentException("Service is required");
        if (r.getEnvironment() == null || r.getEnvironment().isBlank()) throw new IllegalArgumentException("Environment is required");
        if (r.getHelmTag() == null || r.getHelmTag().isBlank()) throw new IllegalArgumentException("Helm tag is required");
        r.setId(null);
        r.setService(r.getService().trim());
        r.setEnvironment(r.getEnvironment().trim().toUpperCase(Locale.ROOT));
        r.setHelmTag(r.getHelmTag().trim());
        return records.save(r);
    }

    @PutMapping("/records/{id}")
    public HelmTagRecord updateRecord(@PathVariable Long id, @RequestBody HelmTagRecord r) {
        HelmTagRecord existing = records.findById(id).orElseThrow(() -> new IllegalArgumentException("No record " + id));
        r.setId(existing.getId());
        r.setCapturedAt(existing.getCapturedAt());
        r.setEnvironment(r.getEnvironment() == null ? existing.getEnvironment() : r.getEnvironment().trim().toUpperCase(Locale.ROOT));
        return records.save(r);
    }

    @DeleteMapping("/records/{id}")
    public void deleteRecord(@PathVariable Long id) {
        records.deleteById(id);
    }

    // ------------------------------------------------------------------ flow & snapshot documents

    public record DocRequest(String name, String body) {}

    @GetMapping("/docs/{kind}")
    public List<JsonDoc> listDocs(@PathVariable String kind) {
        return docs.findAllByKindOrderByUpdatedAtDesc(kind);
    }

    @PostMapping("/docs/{kind}")
    public JsonDoc createDoc(@PathVariable String kind, @RequestBody DocRequest req) {
        JsonDoc d = new JsonDoc();
        d.setKind(kind);
        d.setName(req.name() == null || req.name().isBlank() ? "Untitled" : req.name().trim());
        d.setBody(req.body() == null ? "{}" : req.body());
        return docs.save(d);
    }

    @PutMapping("/docs/{kind}/{id}")
    public JsonDoc updateDoc(@PathVariable String kind, @PathVariable Long id, @RequestBody DocRequest req) {
        JsonDoc d = docs.findById(id).filter(x -> x.getKind().equals(kind)).orElseThrow(() -> new IllegalArgumentException("No " + kind + " " + id));
        if (req.name() != null && !req.name().isBlank()) d.setName(req.name().trim());
        if (req.body() != null) d.setBody(req.body());
        return docs.save(d);
    }

    @DeleteMapping("/docs/{kind}/{id}")
    public void deleteDoc(@PathVariable String kind, @PathVariable Long id) {
        docs.deleteById(id);
    }
}
