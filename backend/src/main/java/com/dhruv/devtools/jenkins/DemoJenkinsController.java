package com.dhruv.devtools.jenkins;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.atomic.AtomicLong;

/**
 * A small, in-memory, time-driven imitation of a Jenkins controller, served at /demo-jenkins.
 * It speaks the same REST dialect the real client uses (api/json, buildWithParameters + queue
 * Location, crumbIssuer, wfapi/describe, wfapi/pendingInputActions, input/{id}/proceedEmpty|submit|abort,
 * logText/progressiveText, consoleText, stop) so the whole CI → CD → Proceed → Helm tag flow can
 * be exercised — and demoed — without a real Jenkins. Builds advance with wall-clock time; a CD
 * pipeline pauses at its approval stage until someone proceeds or aborts.
 */
@RestController
public class DemoJenkinsController {

    private static final String PREFIX = "/demo-jenkins";
    private static final String CRUMB = "demo-crumb-" + Long.toHexString(new Random().nextLong());
    private final ObjectMapper mapper = new ObjectMapper();
    private final Map<String, Job> jobs = new LinkedHashMap<>();
    private final Map<Long, QueueItem> queue = new LinkedHashMap<>();
    private final AtomicLong queueSeq = new AtomicLong(400);

    record Param(String name, String type, String def, List<String> choices, String description) {}

    record Stage(String name, long durMs, List<String> lines, boolean input, String inputMessage, List<Param> inputParams, boolean fail) {}

    static final class Job {
        final String path, name, kind; // kind: folder | pipeline | freestyle
        final String description;
        final List<Param> params = new ArrayList<>();
        final List<Build> builds = new ArrayList<>();
        int nextNumber = 1;
        Job(String path, String kind, String description) {
            this.path = path;
            this.name = path.substring(path.lastIndexOf('/') + 1);
            this.kind = kind;
            this.description = description;
        }
    }

    static final class Build {
        int number;
        long startedAt;
        Map<String, String> params = new LinkedHashMap<>();
        List<Stage> stages = new ArrayList<>();
        Long inputResolvedAt;
        String inputOutcome;
        Map<String, String> inputParams = new LinkedHashMap<>();
        Long stoppedAt;
        String cause = "Started by user Demo User";
    }

    static final class QueueItem {
        long id;
        Job job;
        Map<String, String> params;
        long createdAt;
        Build build;
    }

    /** Computed, point-in-time view of a build. */
    record View(String result, boolean building, List<String[]> stageStates, String log, long duration) {}

    public DemoJenkinsController() {
        folder("platform", "Platform team services");
        for (String svc : List.of("order-service", "payment-service", "inventory-service")) {
            Job ci = add(new Job("platform/" + svc + "-ci", "pipeline", "Builds, tests and publishes " + svc));
            ci.params.add(new Param("BRANCH", "StringParameterDefinition", "main", null, "Git branch to build"));
            ci.params.add(new Param("SIMULATE_FAILURE", "BooleanParameterDefinition", "false", null, "Make the Unit Tests stage fail"));
            Job cd = add(new Job("platform/" + svc + "-cd", "pipeline", "Packages the Helm chart for " + svc + " and deploys it after approval"));
            cd.params.add(new Param("VERSION", "StringParameterDefinition", "", null, "Artifact version from CI (blank = latest green CI build)"));
            cd.params.add(new Param("ENV", "ChoiceParameterDefinition", "DIT", List.of("DIT", "UAT", "PROD"), "Target environment"));
            cd.params.add(new Param("DRY_RUN", "BooleanParameterDefinition", "false", null, "helm --dry-run only"));
        }
        Job re = add(new Job("platform/rehydrate-environment", "pipeline", "Re-deploys a set of services at pinned Helm tags"));
        re.params.add(new Param("ENV", "ChoiceParameterDefinition", "DIT", List.of("DIT", "UAT", "PROD"), "Environment to rehydrate"));
        re.params.add(new Param("MANIFEST", "TextParameterDefinition", "", null, "service=helmTag, one per line"));
        folder("tools", "Utility jobs");
        add(new Job("tools/nightly-regression", "freestyle", "Nightly regression suite (freestyle — no stage view)"));

        // History so the boards aren't empty on first open.
        long now = System.currentTimeMillis();
        for (String svc : List.of("order-service", "payment-service", "inventory-service")) {
            Job ci = jobs.get("platform/" + svc + "-ci");
            Job cd = jobs.get("platform/" + svc + "-cd");
            ci.nextNumber = 40 + svc.length();
            cd.nextNumber = 20 + svc.length();
            for (int i = 3; i >= 1; i--) {
                Build b = start(ci, Map.of("BRANCH", "main", "SIMULATE_FAILURE", "false"), now - i * 86_400_000L);
                Build d = start(cd, Map.of("VERSION", version(svc, b.number), "ENV", i == 1 ? "UAT" : "DIT", "DRY_RUN", "false"), now - i * 86_400_000L + 600_000);
                d.inputResolvedAt = d.startedAt + 120_000;
                d.inputOutcome = "proceed";
            }
        }
        Build nightly = start(jobs.get("tools/nightly-regression"), Map.of(), now - 3_600_000);
        nightly.cause = "Started by timer";
    }

    private void folder(String path, String description) {
        add(new Job(path, "folder", description));
    }

    private Job add(Job j) {
        jobs.put(j.path, j);
        return j;
    }

    private static String service(Job j) {
        return j.name.replaceAll("-(ci|cd)$", "");
    }

    static String version(String svc, int ciNumber) {
        return "1." + (svc.length() % 5 + 2) + "." + ciNumber;
    }

    static String sha(String seed) {
        return String.format("%07x", Math.abs(seed.hashCode()) % 0xFFFFFFF);
    }

    // ------------------------------------------------------------------ build planning

    private Build start(Job job, Map<String, String> requested, long at) {
        Build b = new Build();
        b.number = job.nextNumber++;
        b.startedAt = at;
        for (Param p : job.params) b.params.put(p.name(), requested.getOrDefault(p.name(), p.def()));
        requested.forEach(b.params::putIfAbsent);
        b.stages = plan(job, b);
        job.builds.add(0, b);
        return b;
    }

    private List<Stage> plan(Job job, Build b) {
        String svc = service(job);
        List<Stage> s = new ArrayList<>();
        if (job.name.endsWith("-ci")) {
            String v = version(svc, b.number);
            String commit = sha(svc + b.number);
            boolean fail = "true".equalsIgnoreCase(b.params.get("SIMULATE_FAILURE"));
            s.add(stage("Checkout", 2000, "+ git fetch --no-tags origin " + b.params.get("BRANCH"),
                    "Checking out Revision " + commit + "3e1d9a0b (origin/" + b.params.get("BRANCH") + ")",
                    "Commit message: \"feat: faster checkout for " + svc + "\""));
            s.add(stage("Build", 3000, "+ ./mvnw -B -q clean package -DskipTests", "[INFO] Building " + svc + " " + v,
                    "[INFO] BUILD SUCCESS", "[INFO] Total time:  41.212 s"));
            Stage tests = stage("Unit Tests", 3000, "+ ./mvnw -B test", "[INFO] Tests run: 412, Failures: " + (fail ? 3 : 0) + ", Errors: 0, Skipped: 2",
                    fail ? "[ERROR] OrderPricingTest.discountRounding:88 expected:<10.05> but was:<10.04>" : "[INFO] All tests passed");
            s.add(fail ? new Stage(tests.name(), tests.durMs(), tests.lines(), false, null, null, true) : tests);
            s.add(stage("Publish Artifact", 2000, "+ docker build -t registry.local/" + svc + ":" + v + "-" + commit + " .",
                    "+ docker push registry.local/" + svc + ":" + v + "-" + commit, "Published " + svc + "-" + v + ".jar",
                    "VERSION=" + v, "IMAGE_TAG=" + v + "-" + commit));
        } else if (job.name.endsWith("-cd")) {
            String v = b.params.getOrDefault("VERSION", "");
            if (v.isBlank()) v = latestGreenVersion(svc);
            b.params.put("VERSION", v);
            String env = b.params.getOrDefault("ENV", "DIT");
            String ns = svc.replace("-service", "") + "-" + env.toLowerCase(Locale.ROOT);
            int ciNo = parseTail(v);
            String imageTag = v + "-" + sha(svc + ciNo);
            String helmTag = v + "-" + env.toLowerCase(Locale.ROOT) + "." + b.number;
            boolean dry = "true".equalsIgnoreCase(b.params.get("DRY_RUN"));
            s.add(stage("Prepare", 2000, "Resolving artifact " + svc + ":" + v, "Image registry.local/" + svc + ":" + imageTag + " found",
                    "Target namespace: " + ns));
            s.add(stage("Helm Package", 3000, "+ helm lint charts/" + svc, "1 chart(s) linted, 0 chart(s) failed",
                    "+ helm package charts/" + svc + " --version " + helmTag + " --app-version " + imageTag,
                    "Successfully packaged chart and saved it to: /workspace/" + svc + "-" + helmTag + ".tgz",
                    "+ helm push " + svc + "-" + helmTag + ".tgz oci://registry.local/charts",
                    "Pushed: registry.local/charts/" + svc + ":" + helmTag,
                    "Digest: sha256:" + sha(helmTag) + sha(svc) + "c0ffee"));
            List<Param> ip = new ArrayList<>();
            if ("PROD".equals(env)) ip.add(new Param("CHANGE_REF", "StringParameterDefinition", "CHG-0000", null, "Approved change ticket"));
            s.add(new Stage("Approval", 0, List.of("[Pipeline] input", "Deploy " + svc + " " + helmTag + " to " + env + "?"), true,
                    "Deploy " + svc + " " + helmTag + " to " + env + "?", ip, false));
            s.add(stage("Helm Deploy", 3000,
                    "+ helm upgrade --install " + svc + " oci://registry.local/charts/" + svc + " --version " + helmTag + " --namespace " + ns
                            + " --set image.tag=" + imageTag + " --atomic --wait" + (dry ? " --dry-run" : ""),
                    "Release \"" + svc + "\" has been upgraded. Happy Helming!", "NAME: " + svc, "NAMESPACE: " + ns, "STATUS: deployed",
                    "HELM_TAG=" + helmTag, "CHART_VERSION=" + helmTag));
            s.add(stage("Smoke Test", 2000, "+ curl -fsS http://" + svc + "." + ns + ".svc/actuator/health", "{\"status\":\"UP\"}"));
        } else if (job.name.equals("rehydrate-environment")) {
            String env = b.params.getOrDefault("ENV", "DIT");
            List<String> lines = new ArrayList<>();
            for (String l : b.params.getOrDefault("MANIFEST", "").split("\\R")) {
                String[] kv = l.split("[=:]", 2);
                if (kv.length == 2 && !kv[0].isBlank()) {
                    String svcName = kv[0].trim(), tag = kv[1].trim();
                    lines.add("+ helm upgrade --install " + svcName + " oci://registry.local/charts/" + svcName + " --version " + tag
                            + " --namespace " + svcName.replace("-service", "") + "-" + env.toLowerCase(Locale.ROOT));
                    lines.add("Release \"" + svcName + "\" has been upgraded. Happy Helming!");
                }
            }
            if (lines.isEmpty()) lines.add("Manifest was empty — nothing to rehydrate.");
            s.add(stage("Validate Manifest", 1500, "Validating " + (lines.size() / 2) + " service pin(s) for " + env));
            s.add(new Stage("Rehydrate", 3000, lines, false, null, null, false));
            s.add(stage("Verify", 1500, "All releases report STATUS: deployed"));
        } else {
            s.add(stage("Run", 4000, "Running 128 regression scenarios…", "128 passed, 0 failed"));
        }
        return s;
    }

    private static int parseTail(String v) {
        try {
            return Integer.parseInt(v.substring(v.lastIndexOf('.') + 1).replaceAll("\\D.*", ""));
        } catch (Exception e) {
            return 1;
        }
    }

    private String latestGreenVersion(String svc) {
        Job ci = jobs.get("platform/" + svc + "-ci");
        if (ci == null) return "1.0.0";
        long now = System.currentTimeMillis();
        for (Build b : ci.builds) if ("SUCCESS".equals(view(ci, b, now).result())) return version(svc, b.number);
        return version(svc, 1);
    }

    private static Stage stage(String name, long dur, String... lines) {
        return new Stage(name, dur, List.of(lines), false, null, null, false);
    }

    // ------------------------------------------------------------------ simulation

    View view(Job job, Build b, long now) {
        List<String> log = new ArrayList<>();
        log.add(b.cause);
        boolean pipeline = "pipeline".equals(job.kind);
        if (pipeline) log.add("[Pipeline] Start of Pipeline");
        log.add("Running on agent-" + (b.number % 4 + 1) + " in /var/jenkins/workspace/" + job.path.replace('/', '_'));
        if (!b.params.isEmpty()) log.add("Parameters: " + b.params);
        List<String[]> states = new ArrayList<>();
        long t = b.startedAt;
        String result = null;
        boolean building = false;
        boolean halted = false;
        for (Stage st : b.stages) {
            if (halted) {
                states.add(new String[]{st.name(), "NOT_EXECUTED", String.valueOf(t), "0", "0"});
                continue;
            }
            if (b.stoppedAt != null && b.stoppedAt <= t) {
                states.add(new String[]{st.name(), "NOT_EXECUTED", String.valueOf(t), "0", "0"});
                halted = true;
                result = "ABORTED";
                continue;
            }
            if (now < t) { // still in the future
                states.add(new String[]{st.name(), "NOT_EXECUTED", String.valueOf(t), "0", "0"});
                building = true;
                halted = true;
                continue;
            }
            if (pipeline) log.add("[Pipeline] { (" + st.name() + ")");
            if (st.input()) {
                log.addAll(st.lines());
                if (b.inputResolvedAt == null && (b.stoppedAt == null)) {
                    log.add("Proceed or Abort");
                    states.add(new String[]{st.name(), "PAUSED_PENDING_INPUT", String.valueOf(t), String.valueOf(now - t), String.valueOf(now - t)});
                    building = true;
                    halted = true;
                    continue;
                }
                long end = b.inputResolvedAt != null ? Math.max(t, b.inputResolvedAt) : b.stoppedAt;
                if ("abort".equals(b.inputOutcome) || b.inputResolvedAt == null) {
                    log.add("Rejected by Demo User");
                    states.add(new String[]{st.name(), "ABORTED", String.valueOf(t), String.valueOf(end - t), String.valueOf(end - t)});
                    result = "ABORTED";
                    halted = true;
                    t = end;
                    continue;
                }
                log.add("Approved by Demo User" + (b.inputParams.isEmpty() ? "" : " " + b.inputParams));
                states.add(new String[]{st.name(), "SUCCESS", String.valueOf(t), String.valueOf(end - t), String.valueOf(end - t)});
                if (pipeline) log.add("[Pipeline] }");
                t = end;
                continue;
            }
            long end = t + st.durMs();
            long stopAt = b.stoppedAt == null ? Long.MAX_VALUE : b.stoppedAt;
            if (now < end && stopAt > now) {
                int shown = (int) Math.ceil(st.lines().size() * (double) (now - t) / Math.max(1, st.durMs()));
                log.addAll(st.lines().subList(0, Math.min(shown, st.lines().size())));
                states.add(new String[]{st.name(), "IN_PROGRESS", String.valueOf(t), String.valueOf(now - t), "0"});
                building = true;
                halted = true;
                continue;
            }
            if (stopAt < end) {
                log.add("Aborted by Demo User");
                states.add(new String[]{st.name(), "ABORTED", String.valueOf(t), String.valueOf(stopAt - t), "0"});
                result = "ABORTED";
                halted = true;
                t = stopAt;
                continue;
            }
            log.addAll(st.lines());
            if (st.fail()) {
                log.add("ERROR: script returned exit code 1");
                states.add(new String[]{st.name(), "FAILED", String.valueOf(t), String.valueOf(st.durMs()), "0"});
                result = "FAILURE";
                halted = true;
                t = end;
                continue;
            }
            states.add(new String[]{st.name(), "SUCCESS", String.valueOf(t), String.valueOf(st.durMs()), "0"});
            if (pipeline) log.add("[Pipeline] }");
            t = end;
        }
        if (!building) {
            if (result == null) result = "SUCCESS";
            if (pipeline) log.add("[Pipeline] End of Pipeline");
            log.add("Finished: " + result);
        }
        long duration = building ? 0 : t - b.startedAt;
        return new View(building ? null : result, building, states, String.join("\n", log) + "\n", duration);
    }

    // ------------------------------------------------------------------ http dispatch

    @RequestMapping(PREFIX + "/**")
    public synchronized void handle(HttpServletRequest req, HttpServletResponse res) throws IOException {
        res.setHeader("X-Jenkins", "2.479.1-demo");
        String rest = req.getRequestURI().substring(req.getContextPath().length() + PREFIX.length());
        List<String> seg = new ArrayList<>();
        for (String s : rest.split("/")) if (!s.isEmpty()) seg.add(java.net.URLDecoder.decode(s, StandardCharsets.UTF_8));
        String base = req.getScheme() + "://" + req.getServerName() + ":" + req.getServerPort() + req.getContextPath() + PREFIX + "/";
        boolean post = "POST".equalsIgnoreCase(req.getMethod());
        if (post && !CRUMB.equals(req.getHeader("Jenkins-Crumb"))) {
            error(res, 403, "No valid crumb was included in the request");
            return;
        }

        if (seg.isEmpty() || seg.equals(List.of("api", "json"))) { json(res, root(base)); return; }
        if (seg.size() >= 2 && seg.get(0).equals("crumbIssuer")) {
            json(res, mapper.createObjectNode().put("crumb", CRUMB).put("crumbRequestField", "Jenkins-Crumb"));
            return;
        }
        if (seg.get(0).equals("me")) { json(res, mapper.createObjectNode().put("fullName", "Demo User").put("id", "demo")); return; }
        if (seg.get(0).equals("queue") && seg.size() >= 3) { queueItem(res, Long.parseLong(seg.get(2)), base); return; }

        StringBuilder path = new StringBuilder();
        int i = 0;
        while (i + 1 < seg.size() && seg.get(i).equals("job")) {
            if (!path.isEmpty()) path.append('/');
            path.append(seg.get(i + 1));
            i += 2;
        }
        Job job = jobs.get(path.toString());
        if (job == null) { error(res, 404, "No such job " + path); return; }
        List<String> tail = seg.subList(i, seg.size());
        if (tail.isEmpty() || tail.equals(List.of("api", "json"))) { json(res, jobJson(job, base)); return; }
        if (post && (tail.get(0).equals("build") || tail.get(0).equals("buildWithParameters"))) { trigger(req, res, job, base); return; }
        if (!tail.get(0).matches("\\d+|lastBuild|lastSuccessfulBuild")) { error(res, 404, "Unknown endpoint"); return; }

        Build b = findBuild(job, tail.get(0));
        if (b == null) { error(res, 404, "No such build"); return; }
        List<String> op = tail.subList(1, tail.size());
        long now = System.currentTimeMillis();
        View v = view(job, b, now);
        String op0 = op.isEmpty() ? "api" : op.get(0);
        switch (op0) {
            case "api" -> json(res, buildJson(job, b, v, base));
            case "wfapi" -> {
                if (!"pipeline".equals(job.kind)) { error(res, 404, "Not a pipeline"); return; }
                if (op.size() > 1 && op.get(1).equals("pendingInputActions")) json(res, pending(job, b, v, base));
                else json(res, describe(b, v));
            }
            case "logText" -> {
                long start = req.getParameter("start") == null ? 0 : Long.parseLong(req.getParameter("start"));
                String log = v.log();
                String chunk = start >= log.length() ? "" : log.substring((int) start);
                res.setHeader("X-Text-Size", String.valueOf(log.length()));
                if (v.building()) res.setHeader("X-More-Data", "true");
                text(res, chunk);
            }
            case "consoleText" -> text(res, v.log());
            case "stop" -> {
                if (v.building()) b.stoppedAt = now;
                res.setStatus(200);
            }
            case "input" -> {
                if (op.size() < 3) { error(res, 404, "Unknown input endpoint"); return; }
                String action = op.get(2);
                if (!v.building() || b.inputResolvedAt != null) { error(res, 404, "No pending input " + op.get(1)); return; }
                if (!op.get(1).equals(inputId(b))) { error(res, 404, "No pending input " + op.get(1)); return; }
                b.inputResolvedAt = now;
                b.inputOutcome = action.equals("abort") ? "abort" : "proceed";
                if (action.equals("submit")) {
                    String json = req.getParameter("json");
                    if (json != null) for (var p : mapper.readTree(json).path("parameter")) b.inputParams.put(p.path("name").asText(), p.path("value").asText());
                }
                res.setStatus(200);
            }
            default -> error(res, 404, "Unknown endpoint " + op0);
        }
    }

    private static String inputId(Build b) {
        return "ProceedToDeploy";
    }

    private Build findBuild(Job job, String ref) {
        long now = System.currentTimeMillis();
        if (ref.equals("lastBuild")) return job.builds.isEmpty() ? null : job.builds.get(0);
        if (ref.equals("lastSuccessfulBuild")) {
            for (Build b : job.builds) if ("SUCCESS".equals(view(job, b, now).result())) return b;
            return null;
        }
        int n = Integer.parseInt(ref);
        return job.builds.stream().filter(b -> b.number == n).findFirst().orElse(null);
    }

    private void trigger(HttpServletRequest req, HttpServletResponse res, Job job, String base) {
        if ("folder".equals(job.kind)) { error(res, 405, "Folders can't be built"); return; }
        Map<String, String> params = new LinkedHashMap<>();
        req.getParameterMap().forEach((k, v) -> params.put(k, v.length > 0 ? v[0] : ""));
        QueueItem q = new QueueItem();
        q.id = queueSeq.incrementAndGet();
        q.job = job;
        q.params = params;
        q.createdAt = System.currentTimeMillis();
        queue.put(q.id, q);
        res.setStatus(201);
        res.setHeader("Location", base + "queue/item/" + q.id + "/");
    }

    private void queueItem(HttpServletResponse res, long id, String base) throws IOException {
        QueueItem q = queue.get(id);
        if (q == null) { error(res, 404, "No such queue item"); return; }
        long now = System.currentTimeMillis();
        ObjectNode n = mapper.createObjectNode().put("id", id).put("cancelled", false);
        if (q.build == null && now - q.createdAt > 1500) q.build = start(q.job, q.params, now);
        if (q.build == null) {
            n.put("why", "Waiting for next available executor on ‘agent-2’");
            n.putNull("executable");
        } else {
            n.putNull("why");
            n.putObject("executable").put("number", q.build.number).put("url", base + jobPath(q.job) + q.build.number + "/");
        }
        json(res, n);
    }

    // ------------------------------------------------------------------ json shapes

    private static String jobPath(Job j) {
        return JenkinsClient.jobUrlPath(j.path);
    }

    private static String color(View v) {
        if (v == null) return "notbuilt";
        if (v.building()) return "blue_anime";
        return switch (v.result()) {
            case "SUCCESS" -> "blue";
            case "FAILURE" -> "red";
            case "ABORTED" -> "aborted";
            default -> "yellow";
        };
    }

    private static String cls(Job j) {
        return switch (j.kind) {
            case "folder" -> "com.cloudbees.hudson.plugins.folder.Folder";
            case "pipeline" -> "org.jenkinsci.plugins.workflow.job.WorkflowJob";
            default -> "hudson.model.FreeStyleProject";
        };
    }

    private ObjectNode summary(Job j, String base) {
        long now = System.currentTimeMillis();
        ObjectNode n = mapper.createObjectNode();
        n.put("_class", cls(j));
        n.put("name", j.name);
        n.put("url", base + jobPath(j));
        n.put("description", j.description);
        if (!"folder".equals(j.kind)) {
            View v = j.builds.isEmpty() ? null : view(j, j.builds.get(0), now);
            n.put("color", color(v));
            if (v != null) {
                Build b = j.builds.get(0);
                n.putObject("lastBuild").put("number", b.number).put("result", v.result()).put("timestamp", b.startedAt)
                        .put("duration", v.duration()).put("building", v.building());
            } else n.putNull("lastBuild");
        }
        return n;
    }

    private List<Job> children(String folder) {
        List<Job> out = new ArrayList<>();
        for (Job j : jobs.values()) {
            String parent = j.path.contains("/") ? j.path.substring(0, j.path.lastIndexOf('/')) : "";
            if (parent.equals(folder)) out.add(j);
        }
        return out;
    }

    private ObjectNode root(String base) {
        ObjectNode n = mapper.createObjectNode();
        n.put("_class", "hudson.model.Hudson");
        n.put("url", base);
        ArrayNode arr = n.putArray("jobs");
        for (Job j : children("")) arr.add(summary(j, base));
        return n;
    }

    private ObjectNode jobJson(Job j, String base) {
        ObjectNode n = summary(j, base);
        n.put("fullName", j.path);
        if ("folder".equals(j.kind)) {
            ArrayNode arr = n.putArray("jobs");
            for (Job c : children(j.path)) arr.add(summary(c, base));
            return n;
        }
        n.put("buildable", true);
        n.put("nextBuildNumber", j.nextNumber);
        ArrayNode props = n.putArray("property");
        if (!j.params.isEmpty()) {
            ArrayNode defs = props.addObject().putArray("parameterDefinitions");
            for (Param p : j.params) {
                ObjectNode d = defs.addObject().put("name", p.name()).put("type", p.type()).put("description", p.description());
                d.putObject("defaultParameterValue").put("value", p.def());
                if (p.choices() != null) {
                    ArrayNode c = d.putArray("choices");
                    p.choices().forEach(c::add);
                    ((ObjectNode) d.get("defaultParameterValue")).put("value", p.choices().get(0));
                }
            }
        }
        long now = System.currentTimeMillis();
        ArrayNode builds = n.putArray("builds");
        Integer lastOk = null, lastFail = null;
        for (Build b : j.builds) {
            View v = view(j, b, now);
            builds.addObject().put("number", b.number).put("result", v.result()).put("building", v.building())
                    .put("timestamp", b.startedAt).put("duration", v.duration()).put("displayName", "#" + b.number)
                    .put("description", b.params.containsKey("ENV") ? b.params.get("ENV") + " · " + b.params.getOrDefault("VERSION", "") : null);
            if (lastOk == null && "SUCCESS".equals(v.result())) lastOk = b.number;
            if (lastFail == null && "FAILURE".equals(v.result())) lastFail = b.number;
        }
        if (lastOk != null) n.putObject("lastSuccessfulBuild").put("number", lastOk); else n.putNull("lastSuccessfulBuild");
        if (lastFail != null) n.putObject("lastFailedBuild").put("number", lastFail); else n.putNull("lastFailedBuild");
        return n;
    }

    private ObjectNode buildJson(Job j, Build b, View v, String base) {
        ObjectNode n = mapper.createObjectNode();
        n.put("number", b.number);
        n.put("url", base + jobPath(j) + b.number + "/");
        n.put("result", v.result());
        n.put("building", v.building());
        n.put("duration", v.duration());
        long est = b.stages.stream().mapToLong(Stage::durMs).sum();
        n.put("estimatedDuration", est);
        n.put("timestamp", b.startedAt);
        n.put("displayName", "#" + b.number);
        n.put("fullDisplayName", j.path.replace("/", " » ") + " #" + b.number);
        if (b.params.containsKey("ENV")) n.put("description", b.params.get("ENV") + " · " + b.params.getOrDefault("VERSION", ""));
        else n.putNull("description");
        ArrayNode actions = n.putArray("actions");
        ArrayNode causes = actions.addObject().putArray("causes");
        causes.addObject().put("shortDescription", b.cause).put("userName", "Demo User");
        if (!b.params.isEmpty()) {
            ArrayNode ps = actions.addObject().put("_class", "hudson.model.ParametersAction").putArray("parameters");
            b.params.forEach((k, val) -> ps.addObject().put("name", k).put("value", val));
        }
        ArrayNode arts = n.putArray("artifacts");
        if (j.name.endsWith("-ci") && "SUCCESS".equals(v.result())) {
            String f = service(j) + "-" + version(service(j), b.number) + ".jar";
            arts.addObject().put("fileName", f).put("relativePath", "target/" + f);
        }
        ArrayNode cs = n.putArray("changeSets");
        if (j.name.endsWith("-ci")) {
            cs.addObject().putArray("items").addObject().put("msg", "feat: faster checkout for " + service(j))
                    .put("commitId", sha(service(j) + b.number) + "3e1d9a0b").putObject("author").put("fullName", "Dhruv");
        }
        return n;
    }

    private ObjectNode describe(Build b, View v) {
        ObjectNode n = mapper.createObjectNode();
        n.put("id", String.valueOf(b.number));
        n.put("name", "#" + b.number);
        n.put("status", v.building() ? (v.stageStates().stream().anyMatch(s -> s[1].equals("PAUSED_PENDING_INPUT")) ? "PAUSED_PENDING_INPUT" : "IN_PROGRESS")
                : v.result().equals("FAILURE") ? "FAILED" : v.result());
        n.put("startTimeMillis", b.startedAt);
        ArrayNode st = n.putArray("stages");
        int id = 6;
        for (String[] s : v.stageStates()) {
            st.addObject().put("id", String.valueOf(id++)).put("name", s[0]).put("status", s[1])
                    .put("startTimeMillis", Long.parseLong(s[2])).put("durationMillis", Long.parseLong(s[3]))
                    .put("pauseDurationMillis", Long.parseLong(s[4]));
        }
        return n;
    }

    private ArrayNode pending(Job j, Build b, View v, String base) {
        ArrayNode arr = mapper.createArrayNode();
        boolean paused = v.stageStates().stream().anyMatch(s -> s[1].equals("PAUSED_PENDING_INPUT"));
        if (!paused) return arr;
        Stage in = b.stages.stream().filter(Stage::input).findFirst().orElseThrow();
        ObjectNode o = arr.addObject();
        o.put("id", inputId(b));
        o.put("proceedText", "Proceed");
        o.put("message", in.inputMessage());
        ArrayNode inputs = o.putArray("inputs");
        for (Param p : in.inputParams()) {
            ObjectNode f = inputs.addObject().put("name", p.name()).put("type", p.type()).put("description", p.description());
            f.putObject("definition").put("defaultVal", p.def());
        }
        String url = "/" + PREFIX.substring(1) + "/" + jobPath(j) + b.number + "/input/" + inputId(b) + "/";
        o.put("proceedUrl", url + "proceedEmpty");
        o.put("abortUrl", url + "abort");
        return arr;
    }

    private void json(HttpServletResponse res, Object body) throws IOException {
        res.setContentType("application/json");
        res.setCharacterEncoding("UTF-8");
        mapper.writeValue(res.getOutputStream(), body);
    }

    private static void text(HttpServletResponse res, String body) throws IOException {
        res.setContentType("text/plain;charset=UTF-8");
        res.getOutputStream().write(body.getBytes(StandardCharsets.UTF_8));
    }

    private void error(HttpServletResponse res, int status, String message) {
        try {
            res.setStatus(status);
            json(res, mapper.createObjectNode().put("message", message));
        } catch (IOException ignored) {
            // client went away
        }
    }
}
