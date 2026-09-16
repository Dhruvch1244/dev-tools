package com.dhruv.devtools.springviz;

import com.dhruv.devtools.springviz.dto.SpringVizResult;
import com.dhruv.devtools.springviz.dto.SpringVizResult.Cycle;
import com.dhruv.devtools.springviz.dto.SpringVizResult.Edge;
import com.dhruv.devtools.springviz.dto.SpringVizResult.Endpoint;
import com.dhruv.devtools.springviz.dto.SpringVizResult.Node;
import com.github.javaparser.StaticJavaParser;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.*;
import java.util.stream.Stream;

/**
 * Static-analysis repo visualizer: walks local Spring Boot source with JavaParser (AST only,
 * no compilation/classpath needed) to find @RestController/@Service/@Repository/@Component
 * classes, the HTTP endpoints controllers expose, "depends on" edges inferred from field/
 * constructor injection, @FeignClient-based cross-service calls, and circular dependencies.
 *
 * Two scan modes, auto-detected from the folder you point it at:
 *  - Single project: the root itself is (or contains, Maven-multi-module-style) one build.
 *    Every class gets tagged with its `module` (nearest ancestor dir with a pom.xml/build.gradle).
 *  - Workspace: the root has no build file of its own but >= 2 immediate subdirectories that
 *    each do — i.e. a folder of several independent services. Every class additionally gets
 *    tagged with its `project` (which immediate subdirectory it came from), so the frontend can
 *    group/filter by service. @FeignClient interfaces become edges to a synthetic external-
 *    service node, resolved to a real scanned project when the Feign client name matches one.
 *
 * This is deliberately a heuristic, not a full Spring context resolution — no classpath
 * scanning, no interface-to-impl resolution, no conditional beans. Good enough to see the
 * shape of a codebase (or a workspace of them) at a glance.
 */
@Service
public class SpringVizService {

    private static final Logger log = LoggerFactory.getLogger(SpringVizService.class);

    private static final Set<String> STEREOTYPES = Set.of(
            "RestController", "Controller", "Service", "Repository", "Component", "Configuration");

    private static final Map<String, String> MAPPING_TO_METHOD = Map.of(
            "GetMapping", "GET",
            "PostMapping", "POST",
            "PutMapping", "PUT",
            "DeleteMapping", "DELETE",
            "PatchMapping", "PATCH");

    public SpringVizResult.Response analyze(String rootPath) {
        Path root = Path.of(rootPath);
        if (!Files.isDirectory(root)) {
            throw new IllegalArgumentException("'" + rootPath + "' is not a directory.");
        }

        boolean workspace = isWorkspace(root);
        List<Path> projectRoots = workspace ? immediateBuildRoots(root) : List.of(root);

        List<Path> javaFiles;
        try (Stream<Path> walk = Files.walk(root)) {
            javaFiles = walk
                    .filter(p -> p.toString().endsWith(".java"))
                    .filter(p -> !p.toString().contains(targetDirMarker()) && !p.toString().contains(buildDirMarker()))
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
        if (javaFiles.isEmpty()) {
            throw new IllegalArgumentException("No .java files found under '" + rootPath + "'.");
        }

        // Pass 1: every stereotyped class, keyed by simple class name; every @FeignClient interface separately.
        Map<String, Node> nodesByName = new LinkedHashMap<>();
        Map<String, ClassOrInterfaceDeclaration> declByName = new HashMap<>();
        Map<String, String> feignTargetByInterface = new HashMap<>();
        int scanned = 0;

        for (Path file : javaFiles) {
            CompilationUnit cu;
            try {
                cu = StaticJavaParser.parse(file);
                scanned++;
            } catch (Exception e) {
                continue; // unparsable file — skip, don't fail the whole scan
            }
            String pkg = cu.getPackageDeclaration().map(pd -> pd.getNameAsString()).orElse("");
            String module = nearestModuleName(file, root);
            String project = workspace ? topLevelDirName(file, root) : "";

            for (ClassOrInterfaceDeclaration decl : cu.findAll(ClassOrInterfaceDeclaration.class)) {
                String name = decl.getNameAsString();

                if (decl.isInterface()) {
                    feignClientTarget(decl).ifPresent(target -> {
                        feignTargetByInterface.put(name, target);
                        declByName.put(name, decl);
                        nodesByName.put(name, new Node(name, name, pkg, "RemoteClient", 0, module, project));
                    });
                    continue;
                }

                String kind = stereotypeOf(decl);
                if (kind == null) continue;
                declByName.put(name, decl);
                nodesByName.put(name, new Node(name, name, pkg, kind, 0, module, project));
            }
        }

        // Pass 2: endpoints (controllers only) + dependency edges (any bean -> any other known bean/Feign client).
        List<Endpoint> endpoints = new ArrayList<>();
        List<Edge> edges = new ArrayList<>();
        Map<String, Integer> endpointCounts = new HashMap<>();

        for (var entry : declByName.entrySet()) {
            String name = entry.getKey();
            try {
                ClassOrInterfaceDeclaration decl = entry.getValue();
                Node node = nodesByName.get(name);
                String kind = node.kind();

                if (kind.equals("RestController") || kind.equals("Controller")) {
                    String basePath = classRequestMappingPath(decl);
                    for (MethodDeclaration m : decl.getMethods()) {
                        for (AnnotationExpr ann : m.getAnnotations()) {
                            String annName = ann.getNameAsString();
                            String httpMethod = MAPPING_TO_METHOD.get(annName);
                            if (httpMethod == null && !annName.equals("RequestMapping")) continue;
                            if (httpMethod == null) httpMethod = "GET"; // bare @RequestMapping default, heuristic

                            String methodPath = firstStringValue(ann, "value", "path").orElse("");
                            String fullPath = joinPaths(basePath, methodPath);
                            endpoints.add(new Endpoint(httpMethod, fullPath, name, m.getNameAsString(), node.project()));
                            endpointCounts.merge(name, 1, Integer::sum);
                        }
                    }
                }

                if (!kind.equals("RemoteClient")) {
                    for (String depType : injectedTypeNames(decl)) {
                        if (declByName.containsKey(depType) && !depType.equals(name)) {
                            edges.add(new Edge(name, depType));
                        }
                    }
                }
            } catch (Exception e) {
                // One class with an unusual/edge-case AST shape shouldn't take down the whole scan —
                // log and skip it, same policy as the per-file parse failures in pass 1.
                log.warn("Skipping class '{}' during Spring Boot Visualizer analysis: {}", name, e.toString());
            }
        }

        // Feign clients -> a synthetic external-service node per distinct target, resolved to a
        // real scanned project's name when the workspace has one that matches (case-insensitive,
        // ignoring separators — "order-service" vs "OrderService" vs "order_service" all match).
        Set<String> knownProjects = projectRoots.stream().map(p -> p.getFileName().toString()).collect(java.util.stream.Collectors.toSet());
        for (var e : feignTargetByInterface.entrySet()) {
            try {
                String interfaceName = e.getKey();
                String target = e.getValue();
                String resolved = resolveToKnownProject(target, knownProjects).orElse(target);
                String externalId = "service:" + resolved;
                nodesByName.putIfAbsent(externalId, new Node(externalId, resolved, "", "ExternalService", 0, "", resolved));
                edges.add(new Edge(interfaceName, externalId));
            } catch (Exception ex) {
                log.warn("Skipping Feign client '{}' during Spring Boot Visualizer analysis: {}", e.getKey(), ex.toString());
            }
        }

        List<Node> nodes = nodesByName.values().stream()
                .map(n -> new Node(n.id(), n.simpleName(), n.packageName(), n.kind(), endpointCounts.getOrDefault(n.id(), 0), n.module(), n.project()))
                .sorted(Comparator.comparing(Node::kind).thenComparing(Node::simpleName))
                .toList();

        List<Edge> dedupedEdges = edges.stream().distinct().toList();
        List<Cycle> cycles;
        try {
            cycles = findCycles(nodes, dedupedEdges);
        } catch (Exception e) {
            log.warn("Circular-dependency detection failed, continuing without it: {}", e.toString());
            cycles = List.of();
        }

        AppConfig config;
        try {
            config = readAppConfig(root);
        } catch (Exception e) {
            log.warn("Could not read application.properties/.yml, continuing without port/context-path: {}", e.toString());
            config = new AppConfig(null, null);
        }
        List<String> projectNames = workspace ? new ArrayList<>(knownProjects) : List.of();
        Collections.sort(projectNames);

        return new SpringVizResult.Response(nodes, dedupedEdges, endpoints, config.contextPath, config.port, scanned, workspace, projectNames, cycles);
    }

    /**
     * A workspace: >=2 immediate children have their own build file. Deliberately does NOT
     * require the root to lack a build file — a real Maven/Gradle multi-module project's root
     * almost always HAS a parent/aggregator pom.xml alongside its module subdirectories, and that
     * case must still be treated as a workspace (this used to require a build-file-less root,
     * which meant it silently never activated for the single most common multi-module layout).
     */
    private boolean isWorkspace(Path root) {
        return immediateBuildRoots(root).size() >= 2;
    }

    private List<Path> immediateBuildRoots(Path root) {
        try (Stream<Path> children = Files.list(root)) {
            return children.filter(Files::isDirectory).filter(this::hasBuildFile).toList();
        } catch (IOException e) {
            return List.of();
        }
    }

    private boolean hasBuildFile(Path dir) {
        return Files.exists(dir.resolve("pom.xml")) || Files.exists(dir.resolve("build.gradle")) || Files.exists(dir.resolve("build.gradle.kts"));
    }

    /** Nearest ancestor directory (relative to root, inclusive) that has a build file — the Maven/Gradle module a file belongs to. */
    private String nearestModuleName(Path file, Path root) {
        Path dir = file.getParent();
        while (dir != null && !dir.equals(root.getParent())) {
            if (hasBuildFile(dir)) return dir.getFileName() == null ? "" : dir.getFileName().toString();
            if (dir.equals(root)) break;
            dir = dir.getParent();
        }
        return "";
    }

    private String topLevelDirName(Path file, Path root) {
        Path rel = root.relativize(file);
        return rel.getNameCount() > 0 ? rel.getName(0).toString() : "";
    }

    private Optional<String> resolveToKnownProject(String target, Set<String> knownProjects) {
        String normalizedTarget = normalize(target);
        for (String p : knownProjects) {
            if (normalize(p).equals(normalizedTarget)) return Optional.of(p);
        }
        return Optional.empty();
    }

    private String normalize(String s) {
        return s.toLowerCase().replaceAll("[-_]", "");
    }

    /** @FeignClient(name="x") / (value="x") / (url="x") — any of the three name the remote service. */
    private Optional<String> feignClientTarget(ClassOrInterfaceDeclaration decl) {
        for (AnnotationExpr ann : decl.getAnnotations()) {
            if (!ann.getNameAsString().equals("FeignClient")) continue;
            return firstStringValue(ann, "name", "value", "url");
        }
        return Optional.empty();
    }

    /** DFS cycle detection over the bean-dependency graph, reported once per distinct cycle (by node set). */
    private List<Cycle> findCycles(List<Node> nodes, List<Edge> edges) {
        Map<String, List<String>> adjacency = new HashMap<>();
        for (Edge e : edges) adjacency.computeIfAbsent(e.from(), k -> new ArrayList<>()).add(e.to());

        List<Cycle> cycles = new ArrayList<>();
        Set<Set<String>> seen = new HashSet<>();
        Set<String> visiting = new LinkedHashSet<>();
        Set<String> done = new HashSet<>();

        for (Node n : nodes) {
            if (!done.contains(n.id())) dfs(n.id(), adjacency, visiting, done, cycles, seen);
        }
        return cycles;
    }

    private void dfs(String node, Map<String, List<String>> adjacency, Set<String> visiting, Set<String> done, List<Cycle> cycles, Set<Set<String>> seen) {
        visiting.add(node);
        for (String next : adjacency.getOrDefault(node, List.of())) {
            if (visiting.contains(next)) {
                List<String> path = new ArrayList<>(visiting);
                int startIdx = path.indexOf(next);
                List<String> cyclePath = new ArrayList<>(path.subList(startIdx, path.size()));
                cyclePath.add(next);
                if (seen.add(new HashSet<>(cyclePath))) cycles.add(new Cycle(cyclePath));
            } else if (!done.contains(next)) {
                dfs(next, adjacency, visiting, done, cycles, seen);
            }
        }
        visiting.remove(node);
        done.add(node);
    }

    private String stereotypeOf(ClassOrInterfaceDeclaration decl) {
        for (AnnotationExpr ann : decl.getAnnotations()) {
            String n = ann.getNameAsString();
            if (STEREOTYPES.contains(n)) return n;
        }
        return null;
    }

    private String classRequestMappingPath(ClassOrInterfaceDeclaration decl) {
        for (AnnotationExpr ann : decl.getAnnotations()) {
            if (ann.getNameAsString().equals("RequestMapping")) {
                return firstStringValue(ann, "value", "path").orElse("");
            }
        }
        return "";
    }

    private Optional<String> firstStringValue(AnnotationExpr ann, String... memberNames) {
        if (ann instanceof SingleMemberAnnotationExpr sm) {
            return firstStringFromExpr(sm.getMemberValue());
        }
        if (ann instanceof NormalAnnotationExpr normal) {
            for (MemberValuePair pair : normal.getPairs()) {
                for (String wanted : memberNames) {
                    if (pair.getNameAsString().equals(wanted)) {
                        return firstStringFromExpr(pair.getValue());
                    }
                }
            }
        }
        return Optional.empty();
    }

    private Optional<String> firstStringFromExpr(Expression expr) {
        if (expr instanceof StringLiteralExpr s) return Optional.of(s.asString());
        if (expr instanceof ArrayInitializerExpr arr && !arr.getValues().isEmpty()) {
            Expression first = arr.getValues().get(0);
            if (first instanceof StringLiteralExpr s) return Optional.of(s.asString());
        }
        return Optional.empty();
    }

    private String joinPaths(String base, String method) {
        String b = base == null ? "" : base.trim();
        String m = method == null ? "" : method.trim();
        String joined = m.isEmpty() ? b : (b.endsWith("/") ? b.substring(0, b.length() - 1) : b) + "/" + (m.startsWith("/") ? m.substring(1) : m);
        joined = joined.replaceAll("/+", "/");
        if (joined.length() > 1 && joined.endsWith("/")) joined = joined.substring(0, joined.length() - 1);
        if (joined.isEmpty()) return "/";
        return joined.startsWith("/") ? joined : "/" + joined;
    }

    /** Field injection (@Autowired or plain field) plus constructor-parameter injection. */
    private Set<String> injectedTypeNames(ClassOrInterfaceDeclaration decl) {
        Set<String> types = new LinkedHashSet<>();
        for (FieldDeclaration f : decl.getFields()) {
            if (f.isStatic()) continue;
            for (VariableDeclarator v : f.getVariables()) {
                simpleTypeName(v.getType()).ifPresent(types::add);
            }
        }
        for (ConstructorDeclaration c : decl.getConstructors()) {
            for (Parameter p : c.getParameters()) {
                simpleTypeName(p.getType()).ifPresent(types::add);
            }
        }
        return types;
    }

    private Optional<String> simpleTypeName(com.github.javaparser.ast.type.Type type) {
        if (type.isClassOrInterfaceType()) {
            return Optional.of(type.asClassOrInterfaceType().getNameAsString());
        }
        return Optional.empty();
    }

    private record AppConfig(String contextPath, Integer port) {}

    private AppConfig readAppConfig(Path root) {
        List<Path> candidates;
        try (Stream<Path> walk = Files.walk(root)) {
            candidates = walk
                    .filter(p -> {
                        String n = p.getFileName().toString();
                        return n.equals("application.properties") || n.equals("application.yml") || n.equals("application.yaml");
                    })
                    .toList();
        } catch (IOException e) {
            return new AppConfig(null, null);
        }

        for (Path file : candidates) {
            List<String> lines;
            try {
                lines = Files.readAllLines(file);
            } catch (IOException e) {
                continue;
            }
            AppConfig found = file.toString().endsWith(".properties") ? parseProperties(lines) : parseYaml(lines);
            if (found.contextPath() != null || found.port() != null) return found;
        }
        return new AppConfig(null, null);
    }

    private AppConfig parseProperties(List<String> lines) {
        String contextPath = null;
        Integer port = null;
        for (String line : lines) {
            String trimmed = line.trim();
            if (trimmed.startsWith("server.servlet.context-path")) {
                contextPath = valueAfterEquals(trimmed);
            } else if (trimmed.startsWith("server.port")) {
                port = parseIntSafe(valueAfterEquals(trimmed));
            }
        }
        return new AppConfig(contextPath, port);
    }

    private String valueAfterEquals(String line) {
        int i = line.indexOf('=');
        if (i < 0) i = line.indexOf(':');
        return i < 0 ? null : line.substring(i + 1).trim();
    }

    /** Minimal indentation-tracking YAML walk — only cares about server: / port: / servlet: context-path:. */
    private AppConfig parseYaml(List<String> lines) {
        String contextPath = null;
        Integer port = null;
        Deque<String> stack = new ArrayDeque<>();
        int[] stackIndent = new int[32];
        int depth = 0;

        for (String raw : lines) {
            if (raw.isBlank() || raw.trim().startsWith("#")) continue;
            int indent = raw.length() - raw.stripLeading().length();
            String trimmed = raw.trim();
            int colon = trimmed.indexOf(':');
            if (colon < 0) continue;
            String key = trimmed.substring(0, colon).trim();
            String value = trimmed.substring(colon + 1).trim();

            while (depth > 0 && indent <= stackIndent[depth - 1]) {
                stack.pop();
                depth--;
            }

            List<String> path = new ArrayList<>(stack);
            Collections.reverse(path);
            path.add(key);

            if (path.equals(List.of("server", "port"))) {
                port = parseIntSafe(value);
            } else if (path.equals(List.of("server", "servlet", "context-path"))) {
                contextPath = stripQuotes(value);
            }

            if (value.isEmpty()) {
                stack.push(key);
                stackIndent[depth] = indent;
                depth++;
            }
        }
        return new AppConfig(contextPath, port);
    }

    private String stripQuotes(String s) {
        if (s == null) return null;
        if (s.length() >= 2 && (s.startsWith("\"") && s.endsWith("\"") || s.startsWith("'") && s.endsWith("'"))) {
            return s.substring(1, s.length() - 1);
        }
        return s;
    }

    private Integer parseIntSafe(String s) {
        if (s == null) return null;
        try {
            return Integer.parseInt(s.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private String targetDirMarker() {
        return java.io.File.separator + "target" + java.io.File.separator;
    }

    private String buildDirMarker() {
        return java.io.File.separator + "build" + java.io.File.separator;
    }
}
