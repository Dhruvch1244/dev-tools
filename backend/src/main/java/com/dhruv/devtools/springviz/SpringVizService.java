package com.dhruv.devtools.springviz;

import com.dhruv.devtools.springviz.dto.SpringVizResult;
import com.dhruv.devtools.springviz.dto.SpringVizResult.*;
import com.github.javaparser.JavaParser;
import com.github.javaparser.ParseResult;
import com.github.javaparser.ParserConfiguration;
import com.github.javaparser.ast.CompilationUnit;
import com.github.javaparser.ast.Node.TreeTraversal;
import com.github.javaparser.ast.NodeList;
import com.github.javaparser.ast.body.*;
import com.github.javaparser.ast.expr.*;
import com.github.javaparser.ast.nodeTypes.NodeWithAnnotations;
import com.github.javaparser.ast.type.ClassOrInterfaceType;
import com.github.javaparser.ast.type.Type;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.yaml.snakeyaml.LoaderOptions;
import org.yaml.snakeyaml.Yaml;
import org.yaml.snakeyaml.constructor.SafeConstructor;

import java.io.IOException;
import java.io.StringReader;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.*;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/**
 * Static-analysis repo visualizer: walks local Spring Boot source with JavaParser (AST only,
 * no compilation/classpath needed) and reconstructs as much of the application context as can
 * be known from source alone:
 *
 *  - Beans: @RestController/@Controller/@Service/@Repository/@Component/@Configuration classes,
 *    @ControllerAdvice, Spring Data repository interfaces (no annotation needed — anything
 *    extending JpaRepository/CrudRepository/…), @FeignClient interfaces, and @Bean factory
 *    methods (materialized as nodes only when something actually injects them).
 *  - Dependency edges from constructor, field, setter and Lombok (@RequiredArgsConstructor /
 *    @AllArgsConstructor) injection — resolving interface-typed dependencies to their
 *    implementation(s) and collection injection (List<Handler>) to every implementation.
 *  - HTTP endpoints including multi-path/multi-method mappings, constant-based paths
 *    (ApiPaths.USERS + "/{id}"), mappings inherited from an implemented API interface
 *    (openapi-generator style), parameters, request/response types and method security.
 *  - Non-HTTP entry points (@Scheduled, Kafka/Rabbit/JMS/SQS listeners, @EventListener, @Async,
 *    runners), JPA entities with their relations and repositories, and config keys referenced
 *    by @Value / @ConfigurationProperties cross-checked against every application*.properties/yml.
 *  - Findings: circular dependencies, ambiguous injection, proxy pitfalls (@Transactional on a
 *    private method, self-invocation), layering violations, duplicate mappings, entity leaks,
 *    missing config keys, hard-coded secrets, eager collections, and more.
 *
 * Two scan modes, auto-detected from the folder you point it at:
 *  - Single project: the root itself is (or contains, Maven-multi-module-style) one build.
 *  - Workspace: >= 2 immediate subdirectories each have their own build file. Every class is
 *    tagged with its `project`, and @FeignClient targets resolve to scanned projects by name.
 *
 * Still a heuristic, not a real Spring context: no classpath, no auto-configuration, no
 * conditional evaluation. Every per-file and per-class step is isolated so one odd AST can
 * never take down the whole scan.
 */
@Service
public class SpringVizService {

    private static final Logger log = LoggerFactory.getLogger(SpringVizService.class);

    private static final Map<String, String> STEREOTYPES = Map.of(
            "RestController", "RestController",
            "Controller", "Controller",
            "Service", "Service",
            "Repository", "Repository",
            "Component", "Component",
            "Configuration", "Configuration",
            "AutoConfiguration", "Configuration",
            "SpringBootApplication", "Configuration",
            "ControllerAdvice", "Component",
            "RestControllerAdvice", "Component");

    private static final Map<String, String> MAPPING_TO_METHOD = Map.of(
            "GetMapping", "GET",
            "PostMapping", "POST",
            "PutMapping", "PUT",
            "DeleteMapping", "DELETE",
            "PatchMapping", "PATCH");

    private static final Set<String> SPRING_DATA_BASES = Set.of(
            "Repository", "CrudRepository", "ListCrudRepository", "PagingAndSortingRepository", "ListPagingAndSortingRepository",
            "JpaRepository", "JpaSpecificationExecutor", "MongoRepository", "ReactiveCrudRepository", "ReactiveMongoRepository",
            "R2dbcRepository", "ElasticsearchRepository", "CassandraRepository", "Neo4jRepository", "RevisionRepository",
            "QuerydslPredicateExecutor", "KeyValueRepository", "RedisRepository");

    private static final Set<String> INJECT_ANNOTATIONS = Set.of("Autowired", "Inject", "Resource");
    private static final Set<String> SECURITY_ANNOTATIONS = Set.of("PreAuthorize", "PostAuthorize", "Secured", "RolesAllowed", "PermitAll", "DenyAll");
    private static final Set<String> PROXY_ANNOTATIONS = Set.of("Transactional", "Async", "Cacheable", "CachePut", "CacheEvict", "Retryable");
    private static final Set<String> WRAPPER_TYPES = Set.of("List", "Set", "Collection", "Iterable", "Optional", "ObjectProvider", "Provider", "Lazy", "Supplier", "Map", "SortedSet", "SortedMap");
    private static final Set<String> SIMPLE_TYPES = Set.of(
            "String", "Integer", "int", "Long", "long", "Short", "short", "Double", "double", "Float", "float", "Boolean", "boolean",
            "BigDecimal", "BigInteger", "UUID", "LocalDate", "LocalDateTime", "Instant", "OffsetDateTime", "ZonedDateTime", "Character", "char", "Byte", "byte");
    private static final Set<String> FRAMEWORK_PARAM_TYPES = Set.of(
            "HttpServletRequest", "HttpServletResponse", "ServletRequest", "ServletResponse", "HttpSession", "Principal", "Authentication",
            "Model", "ModelMap", "BindingResult", "Errors", "Locale", "TimeZone", "ZoneId", "WebRequest", "NativeWebRequest",
            "ServerHttpRequest", "ServerHttpResponse", "ServerWebExchange", "UriComponentsBuilder", "RedirectAttributes", "SessionStatus",
            "InputStream", "OutputStream", "Reader", "Writer", "HttpMethod", "HttpEntity", "RequestEntity", "Jwt", "OAuth2User");
    private static final Set<String> SKIP_DIRS = Set.of("target", "build", "node_modules", ".git", ".idea", ".gradle", ".mvn", "out", "dist", ".vscode", "bin", ".settings");
    private static final Pattern PLACEHOLDER = Pattern.compile("\\$\\{([^}:]+)(?::([^}]*))?}");
    private static final Pattern SECRET_KEY = Pattern.compile("(?i)(password|passwd|pwd|secret|token|api[-_.]?key|private[-_.]?key|credentials?|client[-_.]?secret)$");

    // ─── Internal model ──────────────────────────────────────────────────────────────────────

    private record Parsed(Path file, String rel, CompilationUnit cu, String module, String project, boolean test) {}

    private static final class TypeInfo {
        final String name;
        final TypeDeclaration<?> decl;
        final Parsed src;
        final String pkg;
        String kind; // bean kind, or null when not a bean
        final List<String> supertypes = new ArrayList<>();
        final List<ClassOrInterfaceType> supertypeRefs = new ArrayList<>();

        TypeInfo(String name, TypeDeclaration<?> decl, Parsed src, String pkg) {
            this.name = name;
            this.decl = decl;
            this.src = src;
            this.pkg = pkg;
        }

        boolean isInterface() {
            return decl instanceof ClassOrInterfaceDeclaration c && c.isInterface();
        }

        Integer line() {
            return decl.getBegin().map(p -> p.line).orElse(null);
        }
    }

    /** Mutable per-scan state, so the service itself stays a stateless singleton. */
    private static final class Scan {
        final Path root;
        final boolean workspace;
        final Map<String, TypeInfo> types = new LinkedHashMap<>();
        final Map<String, String> constants = new HashMap<>();
        final Map<String, Expression> constantExprs = new HashMap<>();
        final Map<String, Node> nodes = new LinkedHashMap<>();
        final Map<String, String> nodeInjection = new HashMap<>();
        final Set<Edge> edges = new LinkedHashSet<>();
        final List<Endpoint> endpoints = new ArrayList<>();
        final List<EntryPoint> entryPoints = new ArrayList<>();
        final List<SpringVizResult.Entity> entities = new ArrayList<>();
        final List<Finding> findings = new ArrayList<>();
        final List<ParseError> parseErrors = new ArrayList<>();
        final Map<String, List<String>> implsByInterface = new HashMap<>();
        final Map<String, String> beanFactoryOwner = new HashMap<>(); // produced type -> @Configuration class
        final Map<String, List<String>> valueRefs = new TreeMap<>(); // property key -> using classes
        final Map<String, String> valueDefaults = new HashMap<>();
        final Map<String, List<String>> configPropsPrefixes = new TreeMap<>();
        final Map<String, List<String>> definedKeys = new HashMap<>(); // normalized key -> files
        final Set<String> profiles = new TreeSet<>();
        final Map<String, String> repoEntity = new HashMap<>(); // repository -> entity type
        boolean usesValidation;
        boolean usesMethodSecurity;
        int configFiles;

        Scan(Path root, boolean workspace) {
            this.root = root;
            this.workspace = workspace;
        }
    }

    // ─── Entry point ─────────────────────────────────────────────────────────────────────────

    public SpringVizResult.Response analyze(String rootPath) {
        Path root = Path.of(rootPath);
        if (!Files.isDirectory(root)) {
            throw new IllegalArgumentException("'" + rootPath + "' is not a directory.");
        }

        boolean workspace = isWorkspace(root);
        List<Path> projectRoots = workspace ? immediateBuildRoots(root) : List.of(root);
        Scan scan = new Scan(root, workspace);

        List<Path> javaFiles = new ArrayList<>();
        List<Path> configFiles = new ArrayList<>();
        collectFiles(root, javaFiles, configFiles);
        if (javaFiles.isEmpty()) {
            throw new IllegalArgumentException("No .java files found under '" + rootPath + "'.");
        }

        List<Parsed> parsed = parseAll(scan, javaFiles);
        List<Parsed> main = parsed.stream().filter(p -> !p.test()).toList();

        safely("type index", () -> indexTypes(scan, main));
        safely("constants", () -> indexConstants(scan));
        safely("bean detection", () -> detectBeans(scan));
        safely("@Bean factories", () -> indexBeanFactories(scan));

        for (TypeInfo t : new ArrayList<>(scan.types.values())) {
            if (t.kind == null) continue;
            safely("class " + t.name, () -> analyzeBean(scan, t));
        }
        safely("feign clients", () -> resolveFeign(scan, projectRoots));
        safely("entities", () -> analyzeEntities(scan));
        safely("config files", () -> readConfig(scan, configFiles));
        safely("value references", () -> collectValueRefs(scan));

        List<Edge> edges = new ArrayList<>(scan.edges);
        Map<String, Integer> fanIn = new HashMap<>();
        Map<String, Integer> fanOut = new HashMap<>();
        for (Edge e : edges) {
            if (!e.kind().equals("injects")) continue;
            fanIn.merge(e.to(), 1, Integer::sum);
            fanOut.merge(e.from(), 1, Integer::sum);
        }
        Map<String, Integer> endpointCounts = new HashMap<>();
        for (Endpoint e : scan.endpoints) endpointCounts.merge(e.controllerClass(), 1, Integer::sum);

        List<Node> nodes = scan.nodes.values().stream()
                .map(n -> new Node(n.id(), n.simpleName(), n.packageName(), n.kind(), endpointCounts.getOrDefault(n.id(), 0), n.module(), n.project(),
                        n.file(), n.line(), n.lineCount(), n.methodCount(), fanIn.getOrDefault(n.id(), 0), fanOut.getOrDefault(n.id(), 0),
                        scan.nodeInjection.getOrDefault(n.id(), n.injection()), n.annotations(), n.profiles()))
                .sorted(Comparator.comparing(Node::kind).thenComparing(Node::simpleName))
                .toList();

        List<Cycle> cycles = List.of();
        try {
            cycles = findCycles(nodes, edges.stream().filter(e -> e.kind().equals("injects")).toList());
        } catch (Exception e) {
            log.warn("Circular-dependency detection failed, continuing without it: {}", e.toString());
        }

        List<ConfigKey> configKeys = List.of();
        try {
            configKeys = buildConfigKeys(scan);
        } catch (Exception e) {
            log.warn("Config key cross-check failed: {}", e.toString());
        }

        List<Cycle> finalCycles = cycles;
        List<ConfigKey> finalConfigKeys = configKeys;
        safely("findings", () -> addGraphFindings(scan, nodes, finalCycles, finalConfigKeys));

        AppConfig config;
        try {
            config = readAppConfig(configFiles);
        } catch (Exception e) {
            log.warn("Could not read application.properties/.yml, continuing without port/context-path: {}", e.toString());
            config = new AppConfig(null, null);
        }
        Set<String> knownProjects = projectRoots.stream().map(p -> p.getFileName().toString()).collect(Collectors.toSet());
        List<String> projectNames = new ArrayList<>(workspace ? knownProjects : List.of());
        Collections.sort(projectNames);

        List<Finding> findings = scan.findings.stream()
                .sorted(Comparator.comparingInt((Finding f) -> severityRank(f.severity())).thenComparing(Finding::category).thenComparing(f -> f.className() == null ? "" : f.className()))
                .toList();

        int loc = main.stream().mapToInt(p -> p.cu().getEnd().map(e -> e.line).orElse(0)).sum();
        int classes = (int) scan.types.values().stream().filter(t -> !t.isInterface()).count();
        int interfaces = scan.types.size() - classes;
        int beans = (int) nodes.stream().filter(n -> !n.kind().equals("ExternalService")).count();
        Stats stats = new Stats(parsed.size(), parsed.size() - main.size(), classes, interfaces, beans, scan.endpoints.size(), scan.entities.size(),
                loc, scan.configFiles, scan.parseErrors.stream().limit(50).toList());

        scan.endpoints.sort(Comparator.comparing(Endpoint::path).thenComparing(Endpoint::httpMethod));
        scan.entryPoints.sort(Comparator.comparing(EntryPoint::kind).thenComparing(EntryPoint::className));
        scan.entities.sort(Comparator.comparing(SpringVizResult.Entity::name));

        return new SpringVizResult.Response(nodes, edges, scan.endpoints, config.contextPath, config.port, parsed.size(), workspace, projectNames,
                cycles, scan.entryPoints, scan.entities, findings, configKeys, new ArrayList<>(scan.profiles), stats);
    }

    private void safely(String step, Runnable r) {
        try {
            r.run();
        } catch (Exception e) {
            // One class with an unusual/edge-case AST shape shouldn't take down the whole scan.
            log.warn("Spring Boot Visualizer: skipping {} after error: {}", step, e.toString());
        }
    }

    private static int severityRank(String s) {
        return switch (s) {
            case "high" -> 0;
            case "medium" -> 1;
            case "low" -> 2;
            default -> 3;
        };
    }

    // ─── File discovery & parsing ────────────────────────────────────────────────────────────

    /** Walks once, pruning build output / VCS / IDE folders instead of descending into node_modules just to filter it out. */
    private void collectFiles(Path root, List<Path> javaFiles, List<Path> configFiles) {
        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult preVisitDirectory(Path dir, BasicFileAttributes attrs) {
                    if (!dir.equals(root) && SKIP_DIRS.contains(dir.getFileName().toString())) return FileVisitResult.SKIP_SUBTREE;
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) {
                    String n = file.getFileName().toString();
                    if (n.endsWith(".java")) javaFiles.add(file);
                    else if (n.matches("(application|bootstrap)(-[\\w.-]+)?\\.(properties|ya?ml)") && !isTestPath(file)) configFiles.add(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult visitFileFailed(Path file, IOException exc) {
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException e) {
            throw new UncheckedIOException(e);
        }
    }

    private static boolean isTestPath(Path p) {
        String s = p.toString().replace('\\', '/');
        return s.contains("/src/test/") || s.contains("/src/it/") || s.contains("/src/integrationTest/");
    }

    /**
     * Parses in parallel with a modern language level. JavaParser's static default is Java 11,
     * which silently rejected every file using records, text blocks, switch expressions or
     * pattern matching — on a modern codebase that dropped a large share of classes.
     */
    private List<Parsed> parseAll(Scan scan, List<Path> files) {
        ThreadLocal<JavaParser> parsers = ThreadLocal.withInitial(() -> new JavaParser(new ParserConfiguration()
                .setLanguageLevel(ParserConfiguration.LanguageLevel.JAVA_21)
                .setAttributeComments(false)));
        List<ParseError> errors = Collections.synchronizedList(new ArrayList<>());
        List<Parsed> out = files.parallelStream().map(file -> {
            String rel = relative(scan.root, file);
            try {
                String src = new String(Files.readAllBytes(file), StandardCharsets.UTF_8);
                ParseResult<CompilationUnit> res = parsers.get().parse(src);
                if (res.getResult().isEmpty() || !res.isSuccessful()) {
                    String msg = res.getProblems().isEmpty() ? "unparsable" : res.getProblems().get(0).getVerboseMessage();
                    errors.add(new ParseError(rel, truncate(msg.replaceAll("\\s+", " "), 200)));
                    if (res.getResult().isEmpty()) return null;
                }
                return new Parsed(file, rel, res.getResult().get(), nearestModuleName(file, scan.root),
                        scan.workspace ? topLevelDirName(file, scan.root) : "", isTestPath(file));
            } catch (Exception e) {
                errors.add(new ParseError(rel, e.getClass().getSimpleName() + ": " + truncate(String.valueOf(e.getMessage()), 200)));
                return null;
            }
        }).filter(Objects::nonNull).toList();
        errors.sort(Comparator.comparing(ParseError::file));
        scan.parseErrors.addAll(errors);
        return out;
    }

    // ─── Indexing ────────────────────────────────────────────────────────────────────────────

    private void indexTypes(Scan scan, List<Parsed> main) {
        for (Parsed p : main) {
            String pkg = p.cu().getPackageDeclaration().map(pd -> pd.getNameAsString()).orElse("");
            for (TypeDeclaration<?> decl : p.cu().findAll(TypeDeclaration.class)) {
                if (!(decl instanceof ClassOrInterfaceDeclaration) && !(decl instanceof RecordDeclaration) && !(decl instanceof EnumDeclaration)) continue;
                String name = decl.getNameAsString();
                TypeInfo t = new TypeInfo(name, decl, p, pkg);
                if (decl instanceof ClassOrInterfaceDeclaration c) {
                    for (ClassOrInterfaceType s : c.getExtendedTypes()) { t.supertypes.add(s.getNameAsString()); t.supertypeRefs.add(s); }
                    for (ClassOrInterfaceType s : c.getImplementedTypes()) { t.supertypes.add(s.getNameAsString()); t.supertypeRefs.add(s); }
                } else if (decl instanceof RecordDeclaration r) {
                    for (ClassOrInterfaceType s : r.getImplementedTypes()) { t.supertypes.add(s.getNameAsString()); t.supertypeRefs.add(s); }
                }
                // First declaration of a simple name wins; duplicates across modules are rare enough for a heuristic tool.
                scan.types.putIfAbsent(name, t);
            }
        }
    }

    /** static final String constants, so @GetMapping(ApiPaths.USERS + "/{id}") resolves to a real path. */
    private void indexConstants(Scan scan) {
        for (TypeInfo t : scan.types.values()) {
            for (FieldDeclaration f : t.decl.getFields()) {
                boolean constant = f.isStatic() && f.isFinal() || t.isInterface();
                if (!constant) continue;
                for (VariableDeclarator v : f.getVariables()) {
                    v.getInitializer().ifPresent(init -> {
                        scan.constantExprs.put(t.name + "." + v.getNameAsString(), init);
                        scan.constantExprs.putIfAbsent(v.getNameAsString(), init);
                    });
                }
            }
        }
    }

    private void detectBeans(Scan scan) {
        for (TypeInfo t : scan.types.values()) {
            if (t.isInterface()) {
                if (hasAnnotation(t.decl, "FeignClient")) t.kind = "RemoteClient";
                else if (hasAnnotation(t.decl, "Repository") || t.supertypes.stream().anyMatch(SPRING_DATA_BASES::contains)) {
                    t.kind = "Repository";
                    t.supertypeRefs.stream().filter(s -> SPRING_DATA_BASES.contains(s.getNameAsString()))
                            .flatMap(s -> s.getTypeArguments().stream().flatMap(NodeList::stream))
                            .findFirst()
                            .ifPresent(arg -> scan.repoEntity.put(t.name, baseTypeName(arg)));
                }
            } else if (t.decl instanceof ClassOrInterfaceDeclaration) {
                for (AnnotationExpr a : t.decl.getAnnotations()) {
                    String k = STEREOTYPES.get(annName(a));
                    if (k != null) {
                        // Prefer the most specific stereotype when a class carries several.
                        if (t.kind == null || t.kind.equals("Component") || t.kind.equals("Configuration") && !k.equals("Component")) t.kind = k;
                    }
                }
            }
            if (t.kind == null) continue;
            addNode(scan, t, t.kind);
        }
        for (TypeInfo t : scan.types.values()) {
            if (t.kind == null || t.isInterface()) continue;
            for (String s : t.supertypes) scan.implsByInterface.computeIfAbsent(s, k -> new ArrayList<>()).add(t.name);
        }
    }

    private void addNode(Scan scan, TypeInfo t, String kind) {
        List<String> anns = t.decl.getAnnotations().stream().map(AnnotationExpr::getNameAsString)
                .filter(n -> !STEREOTYPES.containsKey(n) || n.equals("SpringBootApplication") || n.endsWith("Advice")).distinct().toList();
        List<String> profiles = t.decl.getAnnotationByName("Profile").map(a -> stringValues(scan, a, "value")).orElse(List.of());
        int lines = t.decl.getRange().map(r -> r.end.line - r.begin.line + 1).orElse(0);
        scan.nodes.put(t.name, new Node(t.name, t.name, t.pkg, kind, 0, t.src.module(), t.src.project(), t.src.rel(), t.line(), lines,
                t.decl.getMethods().size(), 0, 0, "none", anns, profiles));
    }

    private void indexBeanFactories(Scan scan) {
        for (TypeInfo t : scan.types.values()) {
            if (t.kind == null || t.isInterface()) continue;
            for (MethodDeclaration m : t.decl.getMethods()) {
                if (!m.isAnnotationPresent("Bean")) continue;
                String produced = baseTypeName(m.getType());
                if (produced != null) scan.beanFactoryOwner.putIfAbsent(produced, t.name);
            }
        }
    }

    // ─── Per-bean analysis ───────────────────────────────────────────────────────────────────

    private void analyzeBean(Scan scan, TypeInfo t) {
        if (t.kind.equals("RemoteClient")) return; // Feign handled separately
        if (t.isInterface()) return;             // Spring Data repositories have no injection
        ClassOrInterfaceDeclaration decl = (ClassOrInterfaceDeclaration) t.decl;

        analyzeInjection(scan, t, decl);
        if (t.kind.equals("RestController") || t.kind.equals("Controller")) analyzeEndpoints(scan, t, decl);
        analyzeEntryPoints(scan, t, decl);
        analyzeProxyPitfalls(scan, t, decl);
        analyzeMutableState(scan, t, decl);
    }

    private void analyzeInjection(Scan scan, TypeInfo t, ClassOrInterfaceDeclaration decl) {
        boolean lombokRequired = hasAnnotation(decl, "RequiredArgsConstructor");
        boolean lombokAll = hasAnnotation(decl, "AllArgsConstructor");
        boolean ctor = false, field = false, setter = false;

        Map<String, Type> deps = new LinkedHashMap<>(); // raw type string -> type, for qualifier-less ambiguity checks
        Set<String> qualified = new HashSet<>();

        for (FieldDeclaration f : decl.getFields()) {
            if (f.isStatic()) continue;
            boolean annotated = INJECT_ANNOTATIONS.stream().anyMatch(f::isAnnotationPresent);
            boolean viaLombok = lombokAll || lombokRequired && f.isFinal();
            if (f.isAnnotationPresent("Value")) continue;
            for (VariableDeclarator v : f.getVariables()) {
                // A plain, un-annotated, non-final field isn't injected by Spring — unless a constructor
                // parameter feeds it, which the constructor pass below covers. Still keep the old
                // "any field" heuristic for final fields that some explicit constructor assigns.
                if (annotated || viaLombok || f.isFinal()) {
                    deps.putIfAbsent(v.getType().asString(), v.getType());
                    if (f.isAnnotationPresent("Qualifier") || f.isAnnotationPresent("Resource")) qualified.add(v.getType().asString());
                    if (annotated && isResolvableDependency(scan, v.getType())) field = true;
                    if (viaLombok && isResolvableDependency(scan, v.getType())) ctor = true;
                }
            }
        }
        for (ConstructorDeclaration c : decl.getConstructors()) {
            for (Parameter p : c.getParameters()) {
                deps.putIfAbsent(p.getType().asString(), p.getType());
                if (p.isAnnotationPresent("Qualifier")) qualified.add(p.getType().asString());
                if (isResolvableDependency(scan, p.getType())) ctor = true;
            }
        }
        for (MethodDeclaration m : decl.getMethods()) {
            if (!INJECT_ANNOTATIONS.stream().anyMatch(m::isAnnotationPresent)) continue;
            for (Parameter p : m.getParameters()) {
                deps.putIfAbsent(p.getType().asString(), p.getType());
                if (isResolvableDependency(scan, p.getType())) setter = true;
            }
        }

        int styles = (ctor ? 1 : 0) + (field ? 1 : 0) + (setter ? 1 : 0);
        String injection = styles == 0 ? "none" : styles > 1 ? "mixed" : ctor ? "constructor" : field ? "field" : "setter";
        scan.nodeInjection.put(t.name, injection);
        if (field) {
            scan.findings.add(new Finding("low", "Injection", "Field injection",
                    t.name + " uses @Autowired field injection. Constructor injection makes dependencies explicit, allows final fields, and lets tests construct the class without Spring.",
                    t.name, null, t.src.rel(), t.line()));
        }

        for (var dep : deps.entrySet()) {
            Type type = dep.getValue();
            String base = baseTypeName(type);
            if (base == null || base.equals(t.name)) continue;
            boolean collection = isCollectionInjection(type);
            List<String> targets = resolveBean(scan, base);
            if (targets.isEmpty()) continue;
            if (targets.size() > 1 && !collection && !qualified.contains(dep.getKey())) {
                boolean hasPrimary = targets.stream().map(scan.types::get).filter(Objects::nonNull).anyMatch(x -> hasAnnotation(x.decl, "Primary"));
                if (!hasPrimary) {
                    scan.findings.add(new Finding("medium", "Injection", "Ambiguous dependency",
                            t.name + " injects " + base + ", which has " + targets.size() + " implementations (" + String.join(", ", targets)
                                    + ") and none is @Primary. Unless a @Qualifier or parameter name matches a bean name, startup fails with NoUniqueBeanDefinitionException.",
                            t.name, null, t.src.rel(), t.line()));
                }
            }
            for (String target : targets) {
                if (!target.equals(t.name)) scan.edges.add(new Edge(t.name, target, "injects"));
            }
        }
    }

    /** Known bean → itself; interface → its bean implementations; @Bean-produced type → an on-demand node. */
    private List<String> resolveBean(Scan scan, String typeName) {
        if (scan.nodes.containsKey(typeName) && !scan.nodes.get(typeName).kind().equals("ExternalService")) return List.of(typeName);
        List<String> impls = scan.implsByInterface.getOrDefault(typeName, List.of()).stream().filter(scan.nodes::containsKey).toList();
        if (!impls.isEmpty()) return impls;
        String owner = scan.beanFactoryOwner.get(typeName);
        if (owner != null) {
            String id = "bean:" + typeName;
            if (!scan.nodes.containsKey(id)) {
                Node o = scan.nodes.get(owner);
                scan.nodes.put(id, new Node(id, typeName, "", "Bean", 0, o == null ? "" : o.module(), o == null ? "" : o.project(),
                        o == null ? null : o.file(), null, 0, 0, 0, 0, "none", List.of("Bean"), List.of()));
                scan.edges.add(new Edge(owner, id, "produces"));
            }
            return List.of(id);
        }
        TypeInfo t = scan.types.get(typeName);
        if (t != null && hasAnnotation(t.decl, "ConfigurationProperties")) {
            if (!scan.nodes.containsKey(typeName)) addNode(scan, t, "Bean");
            return List.of(typeName);
        }
        return List.of();
    }

    private boolean isResolvableDependency(Scan scan, Type type) {
        String base = baseTypeName(type);
        return base != null && (scan.nodes.containsKey(base) || scan.implsByInterface.containsKey(base) || scan.beanFactoryOwner.containsKey(base)
                || scan.types.containsKey(base) && hasAnnotation(scan.types.get(base).decl, "ConfigurationProperties"));
    }

    private void analyzeEndpoints(Scan scan, TypeInfo t, ClassOrInterfaceDeclaration decl) {
        List<String> basePaths = classMappingPaths(scan, decl);
        List<String> classSecurity = securityOf(decl);

        // openapi-generator style: the controller implements an *Api interface that carries the mappings.
        Map<String, MethodDeclaration> inherited = new HashMap<>();
        List<String> inheritedBase = List.of("");
        for (String s : t.supertypes) {
            TypeInfo api = scan.types.get(s);
            if (api == null || !api.isInterface()) continue;
            List<String> apiBase = classMappingPaths(scan, (ClassOrInterfaceDeclaration) api.decl);
            if (!(apiBase.size() == 1 && apiBase.get(0).isEmpty())) inheritedBase = apiBase;
            for (MethodDeclaration m : api.decl.getMethods()) {
                if (mappingAnnotation(m) != null) inherited.putIfAbsent(m.getNameAsString() + "/" + m.getParameters().size(), m);
            }
        }

        boolean deprecatedClass = decl.isAnnotationPresent("Deprecated");
        for (MethodDeclaration m : decl.getMethods()) {
            MethodDeclaration source = m;
            List<String> bases = basePaths;
            if (mappingAnnotation(m) == null) {
                MethodDeclaration fromApi = inherited.get(m.getNameAsString() + "/" + m.getParameters().size());
                if (fromApi == null) continue;
                source = fromApi;
                if (bases.size() == 1 && bases.get(0).isEmpty()) bases = inheritedBase;
            }
            AnnotationExpr ann = mappingAnnotation(source);
            if (ann == null) continue;

            List<String> methods;
            String fixed = MAPPING_TO_METHOD.get(annName(ann));
            if (fixed != null) methods = List.of(fixed);
            else {
                methods = requestMethods(ann);
                if (methods.isEmpty()) methods = List.of("ANY");
            }
            List<String> paths = stringValues(scan, ann, "value", "path");
            if (paths.isEmpty()) paths = List.of("");

            List<Param> params = paramsOf(scan, m, source);
            List<String> security = new ArrayList<>(classSecurity);
            security.addAll(securityOf(m));
            if (!security.isEmpty()) scan.usesMethodSecurity = true;
            List<String> consumes = stringValues(scan, ann, "consumes");
            List<String> produces = stringValues(scan, ann, "produces");
            boolean deprecated = deprecatedClass || m.isAnnotationPresent("Deprecated") || source.isAnnotationPresent("Deprecated");
            Integer line = m.getBegin().map(p -> p.line).orElse(null);
            String returnType = m.getType().asString();

            for (String base : bases) {
                for (String p : paths) {
                    for (String httpMethod : methods) {
                        scan.endpoints.add(new Endpoint(httpMethod, joinPaths(base, p), t.name, m.getNameAsString(), t.src.project(), params,
                                returnType, consumes, produces, security, deprecated, t.src.rel(), line));
                    }
                }
            }
        }

        if (decl.isAnnotationPresent("Transactional") || decl.getMethods().stream().anyMatch(m -> m.isAnnotationPresent("Transactional"))) {
            scan.findings.add(new Finding("low", "Layering", "@Transactional on a controller",
                    t.name + " declares transactions in the web layer. Transaction boundaries usually belong in the service layer, so they stay consistent for non-HTTP callers and don't span view rendering.",
                    t.name, null, t.src.rel(), t.line()));
        }
    }

    private AnnotationExpr mappingAnnotation(MethodDeclaration m) {
        for (AnnotationExpr a : m.getAnnotations()) {
            String n = annName(a);
            if (MAPPING_TO_METHOD.containsKey(n) || n.equals("RequestMapping")) return a;
        }
        return null;
    }

    private List<String> classMappingPaths(Scan scan, ClassOrInterfaceDeclaration decl) {
        for (AnnotationExpr ann : decl.getAnnotations()) {
            if (annName(ann).equals("RequestMapping")) {
                List<String> v = stringValues(scan, ann, "value", "path");
                return v.isEmpty() ? List.of("") : v;
            }
        }
        return List.of("");
    }

    private List<String> requestMethods(AnnotationExpr ann) {
        if (!(ann instanceof NormalAnnotationExpr normal)) return List.of();
        for (MemberValuePair pair : normal.getPairs()) {
            if (!pair.getNameAsString().equals("method")) continue;
            List<Expression> exprs = pair.getValue() instanceof ArrayInitializerExpr arr ? arr.getValues() : List.of(pair.getValue());
            List<String> out = new ArrayList<>();
            for (Expression e : exprs) {
                String s = e instanceof FieldAccessExpr fa ? fa.getNameAsString() : e instanceof NameExpr ne ? ne.getNameAsString() : e.toString();
                out.add(s.toUpperCase(Locale.ROOT));
            }
            return out;
        }
        return List.of();
    }

    private List<String> securityOf(NodeWithAnnotations<?> n) {
        List<String> out = new ArrayList<>();
        for (AnnotationExpr a : n.getAnnotations()) {
            if (SECURITY_ANNOTATIONS.contains(annName(a))) out.add(truncate(a.toString(), 160));
        }
        return out;
    }

    /** Parameters come from the implementing method (names) but annotations may live on the API interface method. */
    private List<Param> paramsOf(Scan scan, MethodDeclaration impl, MethodDeclaration annotated) {
        List<Param> out = new ArrayList<>();
        for (int i = 0; i < impl.getParameters().size(); i++) {
            Parameter p = impl.getParameter(i);
            Parameter ap = annotated != impl && i < annotated.getParameters().size() ? annotated.getParameter(i) : p;
            String type = p.getType().asString();
            String base = baseTypeName(p.getType());
            if (p.isAnnotationPresent("Valid") || p.isAnnotationPresent("Validated") || ap.isAnnotationPresent("Valid") || ap.isAnnotationPresent("Validated")) {
                scan.usesValidation = true;
            }

            AnnotationExpr a = null;
            String source = null;
            for (Parameter candidate : List.of(ap, p)) {
                for (AnnotationExpr x : candidate.getAnnotations()) {
                    String s = switch (annName(x)) {
                        case "PathVariable" -> "path";
                        case "RequestParam" -> "query";
                        case "RequestBody" -> "body";
                        case "RequestHeader" -> "header";
                        case "CookieValue" -> "cookie";
                        case "ModelAttribute" -> "form";
                        case "RequestPart" -> "form";
                        default -> null;
                    };
                    if (s != null) { a = x; source = s; break; }
                }
                if (a != null) break;
            }

            if (a == null) {
                if (base != null && FRAMEWORK_PARAM_TYPES.contains(base)) continue;
                if ("Pageable".equals(base)) { out.add(new Param("page, size, sort", "pageable", type, false, null)); continue; }
                if (base != null && SIMPLE_TYPES.contains(base)) { out.add(new Param(p.getNameAsString(), "query", type, false, null)); continue; }
                if ("MultipartFile".equals(base)) { out.add(new Param(p.getNameAsString(), "form", type, true, null)); continue; }
                out.add(new Param(p.getNameAsString(), "form", type, false, null));
                continue;
            }

            String name = firstStringValue(scan, a, "value", "name").filter(s -> !s.isBlank()).orElse(p.getNameAsString());
            if (source.equals("body")) name = "body";
            String def = firstStringValue(scan, a, "defaultValue").orElse(null);
            boolean required = booleanValue(a, "required").orElse(def == null) && !"Optional".equals(base);
            out.add(new Param(name, source, type, required, def));
        }
        return out;
    }

    private void analyzeEntryPoints(Scan scan, TypeInfo t, ClassOrInterfaceDeclaration decl) {
        if (t.supertypes.contains("CommandLineRunner") || t.supertypes.contains("ApplicationRunner")) {
            scan.entryPoints.add(new EntryPoint("Runner", t.name, "run", "runs once at startup", t.src.project(), t.src.rel(), t.line()));
        }
        for (MethodDeclaration m : decl.getMethods()) {
            Integer line = m.getBegin().map(p -> p.line).orElse(null);
            for (AnnotationExpr a : m.getAnnotations()) {
                String kind = switch (annName(a)) {
                    case "Scheduled", "Schedules" -> "Scheduled";
                    case "KafkaListener", "KafkaHandler" -> "Kafka";
                    case "RabbitListener", "RabbitHandler" -> "RabbitMQ";
                    case "JmsListener" -> "JMS";
                    case "SqsListener" -> "SQS";
                    case "StreamListener" -> "Stream";
                    case "EventListener", "TransactionalEventListener" -> "Event";
                    case "Async" -> "Async";
                    case "PostConstruct" -> "Startup";
                    default -> null;
                };
                if (kind == null) continue;
                String detail = annotationDetail(scan, a);
                if (kind.equals("Event") && detail.isEmpty() && !m.getParameters().isEmpty()) detail = "on " + m.getParameter(0).getType().asString();
                scan.entryPoints.add(new EntryPoint(kind, t.name, m.getNameAsString(), detail, t.src.project(), t.src.rel(), line));
            }
        }
    }

    private String annotationDetail(Scan scan, AnnotationExpr a) {
        if (a instanceof SingleMemberAnnotationExpr sm) return truncate(renderValue(scan, sm.getMemberValue()), 160);
        if (a instanceof NormalAnnotationExpr n) {
            return truncate(n.getPairs().stream().map(p -> p.getNameAsString() + " = " + renderValue(scan, p.getValue())).collect(Collectors.joining(", ")), 160);
        }
        return "";
    }

    private String renderValue(Scan scan, Expression e) {
        if (e instanceof ArrayInitializerExpr arr) return arr.getValues().stream().map(v -> renderValue(scan, v)).collect(Collectors.joining(", ", "{", "}"));
        return resolveString(scan, e, 0).orElse(e.toString());
    }

    /** @Transactional/@Async/… pitfalls that silently do nothing because of Spring's proxy-based AOP. */
    private void analyzeProxyPitfalls(Scan scan, TypeInfo t, ClassOrInterfaceDeclaration decl) {
        Map<String, Set<String>> proxied = new HashMap<>(); // method name -> proxy annotations on it
        Set<String> classLevel = new HashSet<>();
        for (AnnotationExpr a : decl.getAnnotations()) if (PROXY_ANNOTATIONS.contains(annName(a))) classLevel.add(annName(a));

        for (MethodDeclaration m : decl.getMethods()) {
            Set<String> anns = m.getAnnotations().stream().map(SpringVizService::annName).filter(PROXY_ANNOTATIONS::contains).collect(Collectors.toSet());
            if (anns.isEmpty()) continue;
            proxied.computeIfAbsent(m.getNameAsString(), k -> new HashSet<>()).addAll(anns);
            if (m.isPrivate() || m.isStatic() || m.isFinal()) {
                String why = m.isPrivate() ? "private" : m.isStatic() ? "static" : "final";
                scan.findings.add(new Finding("high", "Proxy pitfall", "@" + String.join("/@", anns) + " on a " + why + " method",
                        t.name + "." + m.getNameAsString() + "() is " + why + ", so Spring's proxy can't intercept it — the annotation is silently ignored.",
                        t.name, m.getNameAsString(), t.src.rel(), m.getBegin().map(p -> p.line).orElse(null)));
            }
            if (anns.contains("Async") && !m.getType().isVoidType()) {
                String rt = baseTypeName(m.getType());
                if (rt != null && !Set.of("Future", "CompletableFuture", "ListenableFuture", "CompletionStage", "Mono", "Flux").contains(rt)) {
                    scan.findings.add(new Finding("medium", "Proxy pitfall", "@Async method returns a plain value",
                            t.name + "." + m.getNameAsString() + "() is @Async but returns " + m.getType().asString() + " — callers receive null. Return void or CompletableFuture.",
                            t.name, m.getNameAsString(), t.src.rel(), m.getBegin().map(p -> p.line).orElse(null)));
                }
            }
        }
        if (proxied.isEmpty()) return;

        Set<String> reported = new HashSet<>();
        for (MethodDeclaration caller : decl.getMethods()) {
            Set<String> callerAnns = caller.getAnnotations().stream().map(AnnotationExpr::getNameAsString).collect(Collectors.toSet());
            for (MethodCallExpr call : caller.findAll(MethodCallExpr.class)) {
                boolean self = call.getScope().isEmpty() || call.getScope().get() instanceof ThisExpr;
                if (!self) continue;
                Set<String> targetAnns = proxied.get(call.getNameAsString());
                if (targetAnns == null || call.getNameAsString().equals(caller.getNameAsString())) continue;
                for (String ann : targetAnns) {
                    // Calling a @Transactional method from a method that is itself transactional is fine — the outer tx applies.
                    boolean covered = !ann.equals("Async") && (callerAnns.contains(ann) || classLevel.contains(ann));
                    if (covered || !reported.add(caller.getNameAsString() + "->" + call.getNameAsString() + ann)) continue;
                    scan.findings.add(new Finding("medium", "Proxy pitfall", "Self-invocation bypasses @" + ann,
                            t.name + "." + caller.getNameAsString() + "() calls this." + call.getNameAsString() + "() directly, so the call never goes through Spring's proxy and @" + ann
                                    + " has no effect. Move the method to another bean or inject the bean into itself.",
                            t.name, caller.getNameAsString(), t.src.rel(), call.getBegin().map(p -> p.line).orElse(null)));
                }
            }
        }
    }

    /** Singleton beans holding non-injected, non-final instance fields are shared across every request thread. */
    private void analyzeMutableState(Scan scan, TypeInfo t, ClassOrInterfaceDeclaration decl) {
        if (!Set.of("Service", "Component", "RestController", "Controller").contains(t.kind)) return;
        if (hasAnnotation(decl, "ConfigurationProperties") || hasAnnotation(decl, "AllArgsConstructor") || hasAnnotation(decl, "Data") && hasAnnotation(decl, "Setter")) return;
        Optional<AnnotationExpr> scope = decl.getAnnotationByName("Scope");
        if (scope.isPresent() && !scope.get().toString().contains("singleton")) return;
        if (hasAnnotation(decl, "RequestScope") || hasAnnotation(decl, "SessionScope")) return;

        Set<String> ctorParamTypes = decl.getConstructors().stream().flatMap(c -> c.getParameters().stream()).map(p -> p.getType().asString()).collect(Collectors.toSet());
        List<String> mutable = new ArrayList<>();
        for (FieldDeclaration f : decl.getFields()) {
            if (f.isStatic() || f.isFinal()) continue;
            if (f.getAnnotations().stream().anyMatch(a -> INJECT_ANNOTATIONS.contains(annName(a)) || Set.of("Value", "PersistenceContext", "Setter", "Getter").contains(annName(a)))) continue;
            for (VariableDeclarator v : f.getVariables()) {
                if (ctorParamTypes.contains(v.getType().asString()) || isResolvableDependency(scan, v.getType())) continue;
                String base = baseTypeName(v.getType());
                if (base != null && (base.startsWith("Atomic") || base.startsWith("Concurrent") || base.equals("ThreadLocal") || base.equals("Logger"))) continue;
                mutable.add(v.getNameAsString());
            }
        }
        if (mutable.isEmpty()) return;
        scan.findings.add(new Finding("low", "Thread safety", "Mutable state in a singleton bean",
                t.name + " has non-final instance field" + (mutable.size() > 1 ? "s " : " ") + String.join(", ", mutable)
                        + ". Beans are singletons shared by every request thread — if these change after startup, that's a race condition.",
                t.name, null, t.src.rel(), t.line()));
    }

    private void resolveFeign(Scan scan, List<Path> projectRoots) {
        Set<String> knownProjects = projectRoots.stream().map(p -> p.getFileName().toString()).collect(Collectors.toSet());
        for (TypeInfo t : scan.types.values()) {
            if (!"RemoteClient".equals(t.kind)) continue;
            feignClientTarget(scan, t.decl).ifPresent(target -> {
                String resolved = resolveToKnownProject(target, knownProjects).orElse(target);
                String externalId = "service:" + resolved;
                scan.nodes.putIfAbsent(externalId, new Node(externalId, resolved, "", "ExternalService", 0, "", resolved, null, null, 0, 0, 0, 0, "none", List.of(), List.of()));
                scan.edges.add(new Edge(t.name, externalId, "calls"));
            });
        }
    }

    // ─── Entities ────────────────────────────────────────────────────────────────────────────

    private void analyzeEntities(Scan scan) {
        Map<String, List<String>> reposByEntity = new HashMap<>();
        scan.repoEntity.forEach((repo, entity) -> reposByEntity.computeIfAbsent(entity, k -> new ArrayList<>()).add(repo));

        for (TypeInfo t : scan.types.values()) {
            if (!hasAnnotation(t.decl, "Entity") && !hasAnnotation(t.decl, "Document")) continue;
            try {
                String table = t.decl.getAnnotationByName("Table").flatMap(a -> firstStringValue(scan, a, "name", "value"))
                        .or(() -> t.decl.getAnnotationByName("Document").flatMap(a -> firstStringValue(scan, a, "collection", "value")))
                        .orElse(null);
                String idType = null;
                int fieldCount = 0;
                List<Relation> relations = new ArrayList<>();
                for (FieldDeclaration f : allFields(scan, t)) {
                    if (f.isStatic() || f.isAnnotationPresent("Transient")) continue;
                    fieldCount += f.getVariables().size();
                    if (f.isAnnotationPresent("Id") || f.isAnnotationPresent("EmbeddedId")) idType = f.getElementType().asString();
                    for (AnnotationExpr a : f.getAnnotations()) {
                        String n = annName(a);
                        if (!Set.of("OneToMany", "ManyToOne", "OneToOne", "ManyToMany", "ElementCollection").contains(n)) continue;
                        boolean toMany = n.endsWith("ToMany") || n.equals("ElementCollection");
                        String fetch = a.toString();
                        boolean eager = fetch.contains("EAGER") || !fetch.contains("LAZY") && (n.equals("ManyToOne") || n.equals("OneToOne"));
                        for (VariableDeclarator v : f.getVariables()) {
                            relations.add(new Relation(v.getNameAsString(), n, baseTypeName(v.getType()), eager));
                            if (toMany && fetch.contains("EAGER")) {
                                scan.findings.add(new Finding("medium", "JPA", "Eagerly fetched collection",
                                        t.name + "." + v.getNameAsString() + " is a " + n + " with FetchType.EAGER — every load of " + t.name
                                                + " pulls the whole collection (and often causes N+1 queries or Cartesian products). Prefer LAZY plus a fetch join / @EntityGraph where needed.",
                                        t.name, null, t.src.rel(), f.getBegin().map(p -> p.line).orElse(null)));
                            }
                        }
                    }
                }
                if (idType == null && hasAnnotation(t.decl, "Entity")) {
                    scan.findings.add(new Finding("medium", "JPA", "Entity without @Id",
                            t.name + " is an @Entity but no @Id/@EmbeddedId field was found (including in scanned superclasses). Hibernate refuses to start without an identifier.",
                            t.name, null, t.src.rel(), t.line()));
                }
                scan.entities.add(new SpringVizResult.Entity(t.name, t.pkg, table, idType, fieldCount, relations,
                        reposByEntity.getOrDefault(t.name, List.of()), t.src.project(), t.src.rel(), t.line()));
            } catch (Exception e) {
                log.warn("Skipping entity '{}': {}", t.name, e.toString());
            }
        }
    }

    /** Own fields plus those of scanned superclasses (@MappedSuperclass base entities carry the @Id). */
    private List<FieldDeclaration> allFields(Scan scan, TypeInfo t) {
        List<FieldDeclaration> out = new ArrayList<>(t.decl.getFields());
        Set<String> seen = new HashSet<>(Set.of(t.name));
        TypeInfo cur = t;
        while (cur.decl instanceof ClassOrInterfaceDeclaration c && !c.getExtendedTypes().isEmpty()) {
            TypeInfo parent = scan.types.get(c.getExtendedTypes().get(0).getNameAsString());
            if (parent == null || !seen.add(parent.name)) break;
            out.addAll(parent.decl.getFields());
            cur = parent;
        }
        return out;
    }

    // ─── Configuration ───────────────────────────────────────────────────────────────────────

    private void readConfig(Scan scan, List<Path> configFiles) {
        Yaml yaml = new Yaml(new SafeConstructor(new LoaderOptions()));
        for (Path file : configFiles) {
            String name = file.getFileName().toString();
            String rel = relative(scan.root, file);
            Matcher pm = Pattern.compile("^(?:application|bootstrap)-([\\w.-]+)\\.").matcher(name);
            if (pm.find()) scan.profiles.add(pm.group(1));
            try {
                String text = Files.readString(file, StandardCharsets.UTF_8);
                Map<String, String> flat = new LinkedHashMap<>();
                if (name.endsWith(".properties")) {
                    Properties props = new Properties();
                    props.load(new StringReader(text));
                    for (String k : props.stringPropertyNames()) flat.put(k, props.getProperty(k));
                } else {
                    for (Object doc : yaml.loadAll(text)) flatten("", doc, flat);
                }
                scan.configFiles++;
                for (var e : flat.entrySet()) {
                    scan.definedKeys.computeIfAbsent(normalizeKey(e.getKey()), k -> new ArrayList<>()).add(rel);
                    if (e.getKey().endsWith("on-profile") || e.getKey().equals("spring.profiles")) {
                        for (String p : e.getValue().split(",")) if (!p.isBlank()) scan.profiles.add(p.trim().replace("!", ""));
                    }
                    String v = e.getValue() == null ? "" : e.getValue().trim();
                    if (SECRET_KEY.matcher(e.getKey()).find() && !v.isEmpty() && !v.startsWith("${") && !v.equalsIgnoreCase("changeme") && v.length() >= 4) {
                        scan.findings.add(new Finding("medium", "Configuration", "Hard-coded secret in config",
                                e.getKey() + " has a literal value (" + mask(v) + ") in " + rel + ". Reference an environment variable or secret store instead, e.g. ${DB_PASSWORD}.",
                                null, null, rel, lineOf(text, e.getKey())));
                    }
                }
            } catch (Exception e) {
                scan.findings.add(new Finding("info", "Configuration", "Unreadable config file", rel + " could not be parsed: " + truncate(String.valueOf(e.getMessage()), 200),
                        null, null, rel, null));
            }
        }
    }

    @SuppressWarnings("unchecked")
    private void flatten(String prefix, Object value, Map<String, String> out) {
        if (value instanceof Map<?, ?> map) {
            for (var e : map.entrySet()) flatten(prefix.isEmpty() ? String.valueOf(e.getKey()) : prefix + "." + e.getKey(), e.getValue(), out);
        } else if (value instanceof List<?> list) {
            for (int i = 0; i < list.size(); i++) flatten(prefix + "[" + i + "]", list.get(i), out);
            out.put(prefix, list.stream().map(String::valueOf).collect(Collectors.joining(",")));
        } else if (!prefix.isEmpty()) {
            out.put(prefix, value == null ? "" : String.valueOf(value));
        }
    }

    private void collectValueRefs(Scan scan) {
        for (TypeInfo t : scan.types.values()) {
            for (AnnotationExpr a : t.decl.findAll(AnnotationExpr.class, TreeTraversal.PREORDER)) {
                String n = annName(a);
                if (n.equals("Value")) {
                    firstStringValue(scan, a, "value").ifPresent(v -> {
                        Matcher m = PLACEHOLDER.matcher(v);
                        while (m.find()) {
                            String key = m.group(1).trim();
                            scan.valueRefs.computeIfAbsent(key, k -> new ArrayList<>());
                            if (!scan.valueRefs.get(key).contains(t.name)) scan.valueRefs.get(key).add(t.name);
                            if (m.group(2) != null) scan.valueDefaults.put(key, m.group(2));
                        }
                    });
                } else if (n.equals("ConfigurationProperties")) {
                    firstStringValue(scan, a, "prefix", "value").ifPresent(prefix ->
                            scan.configPropsPrefixes.computeIfAbsent(prefix, k -> new ArrayList<>()).add(t.name));
                }
            }
        }
    }

    private List<ConfigKey> buildConfigKeys(Scan scan) {
        List<ConfigKey> out = new ArrayList<>();
        for (var e : scan.valueRefs.entrySet()) {
            String key = e.getKey();
            List<String> definedIn = scan.definedKeys.getOrDefault(normalizeKey(key), List.of());
            boolean defined = !definedIn.isEmpty() || scan.valueDefaults.containsKey(key);
            out.add(new ConfigKey(key, scan.valueDefaults.get(key), defined, e.getValue(), definedIn.stream().distinct().toList()));
        }
        for (var e : scan.configPropsPrefixes.entrySet()) {
            String norm = normalizeKey(e.getKey());
            List<String> files = scan.definedKeys.entrySet().stream().filter(d -> d.getKey().startsWith(norm + ".")).flatMap(d -> d.getValue().stream()).distinct().toList();
            // @ConfigurationProperties fields usually have Java defaults, so a missing prefix is informational, not an error.
            out.add(new ConfigKey(e.getKey() + ".*", "(@ConfigurationProperties)", true, e.getValue(), files));
        }
        return out;
    }

    /** Spring relaxed binding: my.someKey, my.some-key, my.some_key and MY_SOMEKEY all bind the same property. */
    private static String normalizeKey(String key) {
        return key.toLowerCase(Locale.ROOT).replaceAll("\\[\\d+]", "").replace("-", "").replace("_", "");
    }

    // ─── Whole-graph findings ────────────────────────────────────────────────────────────────

    private void addGraphFindings(Scan scan, List<Node> nodes, List<Cycle> cycles, List<ConfigKey> configKeys) {
        Map<String, Node> byId = nodes.stream().collect(Collectors.toMap(Node::id, n -> n, (a, b) -> a));

        for (Cycle c : cycles) {
            boolean ctorOnly = c.path().stream().allMatch(id -> "constructor".equals(scan.nodeInjection.get(id)));
            scan.findings.add(new Finding("high", "Architecture", "Circular dependency",
                    String.join(" → ", c.path()) + (ctorOnly
                            ? ". With constructor injection on every bean in the loop the context cannot start (BeanCurrentlyInCreationException)."
                            : ". Spring Boot 2.6+ refuses circular references by default (spring.main.allow-circular-references=false)."),
                    c.path().get(0), null, byId.containsKey(c.path().get(0)) ? byId.get(c.path().get(0)).file() : null, null));
        }

        for (Edge e : scan.edges) {
            if (!e.kind().equals("injects")) continue;
            Node from = byId.get(e.from());
            Node to = byId.get(e.to());
            if (from == null || to == null) continue;
            boolean fromWeb = from.kind().equals("RestController") || from.kind().equals("Controller");
            boolean toWeb = to.kind().equals("RestController") || to.kind().equals("Controller");
            if (fromWeb && to.kind().equals("Repository")) {
                scan.findings.add(new Finding("low", "Layering", "Controller talks to a repository directly",
                        from.id() + " injects " + to.id() + ", skipping the service layer. Business rules and transactions then end up in the web layer.",
                        from.id(), null, from.file(), from.line()));
            }
            if (toWeb && !fromWeb) {
                scan.findings.add(new Finding("high", "Layering", "Dependency on a controller",
                        from.kind() + " " + from.id() + " injects controller " + to.id() + ". Lower layers should never depend on the web layer — extract the shared logic into a service.",
                        from.id(), null, from.file(), from.line()));
            }
        }

        for (Node n : nodes) {
            if (n.fanOut() > 7 && !n.kind().equals("Configuration")) {
                scan.findings.add(new Finding("medium", "Architecture", "Too many dependencies",
                        n.id() + " depends on " + n.fanOut() + " other beans — a sign it has too many responsibilities and is hard to test. Consider splitting it.",
                        n.id(), null, n.file(), n.line()));
            }
        }

        Set<String> entryClasses = scan.entryPoints.stream().map(EntryPoint::className).collect(Collectors.toSet());
        for (Node n : nodes) {
            if (!Set.of("Service", "Component", "Repository", "RemoteClient").contains(n.kind())) continue;
            if (n.fanIn() > 0 || entryClasses.contains(n.id()) || n.annotations().stream().anyMatch(a -> a.endsWith("Advice"))) continue;
            TypeInfo t = scan.types.get(n.id());
            // Implements/extends something outside the scanned source (Filter, HandlerInterceptor, …) — Spring calls it itself.
            if (t == null || t.supertypes.stream().anyMatch(s -> !scan.types.containsKey(s) && !SPRING_DATA_BASES.contains(s))) continue;
            scan.findings.add(new Finding("info", "Dead code", "Bean with no callers found",
                    n.kind() + " " + n.id() + " isn't injected anywhere in the scanned source and has no scheduled/listener entry point. It may be unused (or only used via reflection/another repository).",
                    n.id(), null, n.file(), n.line()));
        }

        // Duplicate mappings: identical method + path pattern (variable names ignored) in the same project.
        Map<String, List<Endpoint>> byRoute = new LinkedHashMap<>();
        for (Endpoint e : scan.endpoints) {
            String key = e.project() + "|" + e.httpMethod() + "|" + e.path().replaceAll("\\{[^}]*}", "{}");
            byRoute.computeIfAbsent(key, k -> new ArrayList<>()).add(e);
        }
        for (List<Endpoint> dupes : byRoute.values()) {
            Set<String> handlers = dupes.stream().map(d -> d.controllerClass() + "." + d.methodName()).collect(Collectors.toCollection(LinkedHashSet::new));
            if (handlers.size() < 2) continue;
            boolean distinctContent = dupes.stream().map(d -> String.join(",", d.consumes()) + "|" + String.join(",", d.produces())).distinct().count() > 1;
            if (distinctContent) continue;
            Endpoint first = dupes.get(0);
            scan.findings.add(new Finding("high", "Endpoints", "Ambiguous mapping",
                    first.httpMethod() + " " + first.path() + " is mapped by " + String.join(" and ", handlers) + ". Spring fails at startup with \"Ambiguous mapping\".",
                    first.controllerClass(), first.methodName(), first.file(), first.line()));
        }

        Set<String> entityNames = scan.entities.stream().map(SpringVizResult.Entity::name).collect(Collectors.toSet());
        Map<String, List<Endpoint>> byController = scan.endpoints.stream().collect(Collectors.groupingBy(Endpoint::controllerClass, LinkedHashMap::new, Collectors.toList()));
        for (var entry : byController.entrySet()) {
            List<Endpoint> eps = entry.getValue();
            Endpoint any = eps.get(0);
            Set<String> seenMethods = new HashSet<>();
            for (Endpoint e : eps) {
                if (!seenMethods.add(e.methodName())) continue;
                for (String entity : entityNames) {
                    if (Pattern.compile("\\b" + Pattern.quote(entity) + "\\b").matcher(e.returnType()).find()) {
                        scan.findings.add(new Finding("medium", "Endpoints", "Entity returned from the API",
                                e.controllerClass() + "." + e.methodName() + "() returns " + e.returnType() + ". Serializing JPA entities directly leaks the schema, risks LazyInitializationException and infinite recursion on bidirectional relations — map to a DTO.",
                                e.controllerClass(), e.methodName(), e.file(), e.line()));
                        break;
                    }
                }
            }
            if (scan.usesValidation) {
                List<String> unvalidated = eps.stream()
                        .filter(e -> e.params().stream().anyMatch(p -> p.source().equals("body")))
                        .filter(e -> !hasValidBody(scan, e))
                        .map(e -> e.httpMethod() + " " + e.path()).distinct().toList();
                if (!unvalidated.isEmpty()) {
                    scan.findings.add(new Finding("low", "Validation", "@RequestBody without @Valid",
                            entry.getKey() + " accepts request bodies without @Valid on: " + String.join(", ", unvalidated) + ". Bean Validation constraints on those DTOs are not enforced.",
                            entry.getKey(), null, any.file(), any.line()));
                }
            }
            if (scan.usesMethodSecurity) {
                List<String> open = eps.stream()
                        .filter(e -> Set.of("POST", "PUT", "PATCH", "DELETE", "ANY").contains(e.httpMethod()) && e.security().isEmpty())
                        .map(e -> e.httpMethod() + " " + e.path()).distinct().toList();
                if (!open.isEmpty()) {
                    scan.findings.add(new Finding("info", "Security", "Mutating endpoints without method security",
                            "Other endpoints in this codebase use @PreAuthorize/@Secured, but " + entry.getKey() + " exposes " + String.join(", ", open)
                                    + " without one. Fine if a SecurityFilterChain rule covers them — worth double-checking.",
                            entry.getKey(), null, any.file(), any.line()));
                }
            }
        }

        for (ConfigKey k : configKeys) {
            if (k.defined()) continue;
            boolean envStyle = k.key().equals(k.key().toUpperCase(Locale.ROOT));
            scan.findings.add(new Finding(envStyle ? "info" : "medium", "Configuration", "Property not defined anywhere",
                    "${" + k.key() + "} is injected by " + String.join(", ", k.usedIn()) + " with no default, and no application*.properties/yml in the project defines it."
                            + " Startup fails with \"Could not resolve placeholder\" unless it's supplied via environment variables or an external config server.",
                    k.usedIn().get(0), null, scan.types.containsKey(k.usedIn().get(0)) ? scan.types.get(k.usedIn().get(0)).src.rel() : null, null));
        }

        if (!scan.parseErrors.isEmpty()) {
            scan.findings.add(new Finding("info", "Scan", scan.parseErrors.size() + " file(s) could not be parsed",
                    "These files were skipped, so beans or endpoints declared in them are missing: "
                            + scan.parseErrors.stream().limit(5).map(ParseError::file).collect(Collectors.joining(", ")) + (scan.parseErrors.size() > 5 ? ", …" : ""),
                    null, null, null, null));
        }
    }

    private boolean hasValidBody(Scan scan, Endpoint e) {
        TypeInfo t = scan.types.get(e.controllerClass());
        if (t == null) return true;
        boolean classValidated = hasAnnotation(t.decl, "Validated");
        for (MethodDeclaration m : t.decl.getMethodsByName(e.methodName())) {
            for (Parameter p : m.getParameters()) {
                if (p.isAnnotationPresent("RequestBody") && (p.isAnnotationPresent("Valid") || p.isAnnotationPresent("Validated") || classValidated)) return true;
            }
        }
        // Mapping came from an API interface — check its parameters too.
        for (String s : t.supertypes) {
            TypeInfo api = scan.types.get(s);
            if (api == null) continue;
            for (MethodDeclaration m : api.decl.getMethodsByName(e.methodName())) {
                for (Parameter p : m.getParameters()) if (p.isAnnotationPresent("Valid") || p.isAnnotationPresent("Validated")) return true;
            }
        }
        return false;
    }

    // ─── Workspace / module helpers ──────────────────────────────────────────────────────────

    /**
     * A workspace: >=2 immediate children have their own build file. Deliberately does NOT
     * require the root to lack a build file — a real Maven/Gradle multi-module project's root
     * almost always HAS a parent/aggregator pom.xml alongside its module subdirectories.
     */
    private boolean isWorkspace(Path root) {
        return immediateBuildRoots(root).size() >= 2;
    }

    private List<Path> immediateBuildRoots(Path root) {
        try (var children = Files.list(root)) {
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

    private static String relative(Path root, Path file) {
        try {
            return root.relativize(file).toString().replace('\\', '/');
        } catch (Exception e) {
            return file.toString();
        }
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
    private Optional<String> feignClientTarget(Scan scan, TypeDeclaration<?> decl) {
        for (AnnotationExpr ann : decl.getAnnotations()) {
            if (!annName(ann).equals("FeignClient")) continue;
            return firstStringValue(scan, ann, "name", "value", "url");
        }
        return Optional.empty();
    }

    // ─── Cycles ──────────────────────────────────────────────────────────────────────────────

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

    // ─── AST helpers ─────────────────────────────────────────────────────────────────────────

    private static boolean hasAnnotation(NodeWithAnnotations<?> n, String name) {
        return n.getAnnotations().stream().anyMatch(a -> annName(a).equals(name));
    }

    /** Annotation simple name, whether written bare (@Component) or fully qualified (@org.springframework.stereotype.Component). */
    private static String annName(AnnotationExpr a) {
        String s = a.getNameAsString();
        int dot = s.lastIndexOf('.');
        return dot < 0 ? s : s.substring(dot + 1);
    }

    /** List<Foo> → Foo, Optional<Foo> → Foo, Map<String, Foo> → Foo, Foo[] → Foo, a.b.Foo → Foo. */
    private static String baseTypeName(Type type) {
        if (type == null) return null;
        if (type.isArrayType()) return baseTypeName(type.asArrayType().getComponentType());
        if (!type.isClassOrInterfaceType()) return null;
        ClassOrInterfaceType c = type.asClassOrInterfaceType();
        String name = c.getNameAsString();
        if (WRAPPER_TYPES.contains(name) || Set.of("ResponseEntity", "Mono", "Flux", "Page", "Slice", "CompletableFuture").contains(name)) {
            Optional<NodeList<Type>> args = c.getTypeArguments();
            if (args.isPresent() && !args.get().isEmpty()) return baseTypeName(args.get().get(args.get().size() - 1));
        }
        return name;
    }

    private static boolean isCollectionInjection(Type type) {
        return type.isClassOrInterfaceType() && Set.of("List", "Set", "Collection", "Map", "ObjectProvider", "Iterable").contains(type.asClassOrInterfaceType().getNameAsString());
    }

    private Optional<String> firstStringValue(Scan scan, AnnotationExpr ann, String... memberNames) {
        List<String> all = stringValues(scan, ann, memberNames);
        return all.isEmpty() ? Optional.empty() : Optional.of(all.get(0));
    }

    /** Every string an annotation member resolves to — handles arrays, constants and "a" + B concatenation. */
    private List<String> stringValues(Scan scan, AnnotationExpr ann, String... memberNames) {
        Expression expr = null;
        if (ann instanceof SingleMemberAnnotationExpr sm) {
            if (Arrays.asList(memberNames).contains("value")) expr = sm.getMemberValue();
        } else if (ann instanceof NormalAnnotationExpr normal) {
            outer:
            for (String wanted : memberNames) {
                for (MemberValuePair pair : normal.getPairs()) {
                    if (pair.getNameAsString().equals(wanted)) {
                        expr = pair.getValue();
                        break outer;
                    }
                }
            }
        }
        if (expr == null) return List.of();
        List<Expression> items = expr instanceof ArrayInitializerExpr arr ? arr.getValues() : List.of(expr);
        List<String> out = new ArrayList<>();
        for (Expression e : items) resolveString(scan, e, 0).ifPresent(out::add);
        return out;
    }

    private Optional<String> resolveString(Scan scan, Expression e, int depth) {
        if (depth > 8 || e == null) return Optional.empty();
        if (e instanceof StringLiteralExpr s) return Optional.of(s.asString());
        if (e instanceof TextBlockLiteralExpr tb) return Optional.of(tb.asString());
        if (e instanceof CharLiteralExpr c) return Optional.of(String.valueOf(c.asChar()));
        if (e instanceof IntegerLiteralExpr || e instanceof LongLiteralExpr || e instanceof BooleanLiteralExpr) return Optional.of(e.toString());
        if (e instanceof EnclosedExpr en) return resolveString(scan, en.getInner(), depth + 1);
        if (e instanceof BinaryExpr b && b.getOperator() == BinaryExpr.Operator.PLUS) {
            Optional<String> l = resolveString(scan, b.getLeft(), depth + 1);
            Optional<String> r = resolveString(scan, b.getRight(), depth + 1);
            return l.isPresent() && r.isPresent() ? Optional.of(l.get() + r.get()) : Optional.empty();
        }
        String key = e instanceof FieldAccessExpr fa ? fa.getScope().toString().replaceAll(".*\\.", "") + "." + fa.getNameAsString()
                : e instanceof NameExpr n ? n.getNameAsString() : null;
        if (key == null) return Optional.empty();
        String cached = scan.constants.get(key);
        if (cached != null) return Optional.of(cached);
        Expression def = scan.constantExprs.get(key);
        if (def == null && e instanceof FieldAccessExpr fa) def = scan.constantExprs.get(fa.getNameAsString());
        Optional<String> resolved = resolveString(scan, def, depth + 1);
        resolved.ifPresent(v -> scan.constants.put(key, v));
        return resolved;
    }

    private Optional<Boolean> booleanValue(AnnotationExpr ann, String member) {
        if (ann instanceof NormalAnnotationExpr normal) {
            for (MemberValuePair pair : normal.getPairs()) {
                if (pair.getNameAsString().equals(member) && pair.getValue() instanceof BooleanLiteralExpr b) return Optional.of(b.getValue());
            }
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

    private static String truncate(String s, int max) {
        return s == null ? "" : s.length() <= max ? s : s.substring(0, max - 1) + "…";
    }

    private static String mask(String v) {
        return v.length() <= 4 ? "****" : v.substring(0, 2) + "****" + v.substring(v.length() - 1);
    }

    private static Integer lineOf(String text, String dottedKey) {
        String last = dottedKey.replaceAll("\\[\\d+]$", "");
        last = last.substring(last.lastIndexOf('.') + 1);
        String[] lines = text.split("\n", -1);
        for (int i = 0; i < lines.length; i++) {
            String l = lines[i].trim();
            if (l.startsWith(dottedKey) || l.startsWith(last + ":") || l.startsWith(last + " :")) return i + 1;
        }
        return null;
    }

    // ─── Base URL (port / context path) ──────────────────────────────────────────────────────

    private record AppConfig(String contextPath, Integer port) {}

    /** Prefers the default-profile application.* file; falls back to any file that sets them. */
    private AppConfig readAppConfig(List<Path> configFiles) {
        List<Path> ordered = new ArrayList<>(configFiles);
        ordered.sort(Comparator.comparing((Path p) -> p.getFileName().toString().contains("-") ? 1 : 0).thenComparing(Path::toString));
        Yaml yaml = new Yaml(new SafeConstructor(new LoaderOptions()));
        for (Path file : ordered) {
            try {
                Map<String, String> flat = new LinkedHashMap<>();
                String text = Files.readString(file, StandardCharsets.UTF_8);
                if (file.toString().endsWith(".properties")) {
                    Properties props = new Properties();
                    props.load(new StringReader(text));
                    for (String k : props.stringPropertyNames()) flat.put(k, props.getProperty(k));
                } else {
                    for (Object doc : yaml.loadAll(text)) flatten("", doc, flat);
                }
                String ctx = flat.get("server.servlet.context-path");
                if (ctx == null) ctx = flat.get("server.servlet.contextPath");
                Integer port = parseIntSafe(resolveDefault(flat.get("server.port")));
                ctx = resolveDefault(ctx);
                if (ctx != null || port != null) return new AppConfig(ctx, port);
            } catch (Exception ignored) {
                // try the next file
            }
        }
        return new AppConfig(null, null);
    }

    /** "${PORT:8081}" → "8081"; a bare placeholder without default → null. */
    private static String resolveDefault(String v) {
        if (v == null) return null;
        Matcher m = PLACEHOLDER.matcher(v.trim());
        if (m.matches()) return m.group(2);
        return v.trim();
    }

    private static Integer parseIntSafe(String s) {
        if (s == null) return null;
        try {
            return Integer.parseInt(s.replaceAll("[^0-9]", ""));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
