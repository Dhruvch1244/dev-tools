package com.dhruv.devtools.springviz.dto;

import java.util.List;

public class SpringVizResult {

    /**
     * A bean (or bean-like type) in the graph. {@code injection} is how this bean receives its
     * dependencies: "constructor", "field", "setter", "mixed" or "none".
     */
    public record Node(String id, String simpleName, String packageName, String kind, int endpointCount, String module, String project,
                       String file, Integer line, int lineCount, int methodCount, int fanIn, int fanOut, String injection,
                       List<String> annotations, List<String> profiles) {}

    /** kind: "injects" (bean dependency), "produces" (@Bean factory method), "calls" (Feign → remote service). */
    public record Edge(String from, String to, String kind) {}

    /** source: path | query | body | header | cookie | form | pageable. */
    public record Param(String name, String source, String type, boolean required, String defaultValue) {}

    public record Endpoint(String httpMethod, String path, String controllerClass, String methodName, String project,
                           List<Param> params, String returnType, List<String> consumes, List<String> produces,
                           List<String> security, boolean deprecated, String file, Integer line) {}

    /** A cycle is the sequence of node ids that form the loop, e.g. [A, B, C, A]. */
    public record Cycle(List<String> path) {}

    /** Non-HTTP ways code gets triggered: @Scheduled, message listeners, @EventListener, runners, @Async … */
    public record EntryPoint(String kind, String className, String methodName, String detail, String project, String file, Integer line) {}

    public record Relation(String field, String kind, String target, boolean eager) {}

    public record Entity(String name, String packageName, String table, String idType, int fieldCount, List<Relation> relations,
                         List<String> repositories, String project, String file, Integer line) {}

    /** severity: high | medium | low | info. */
    public record Finding(String severity, String category, String title, String detail, String className, String methodName,
                          String file, Integer line) {}

    /** A property referenced from code (@Value / @ConfigurationProperties) and whether any config file defines it. */
    public record ConfigKey(String key, String defaultValue, boolean defined, List<String> usedIn, List<String> definedIn) {}

    public record ParseError(String file, String message) {}

    public record Stats(int javaFiles, int testFiles, int classes, int interfaces, int beans, int endpoints, int entities,
                        int linesOfCode, int configFiles, List<ParseError> parseErrors) {}

    public record Response(
            List<Node> nodes,
            List<Edge> edges,
            List<Endpoint> endpoints,
            String contextPath,
            Integer port,
            int javaFilesScanned,
            boolean workspace,
            List<String> projects,
            List<Cycle> cycles,
            List<EntryPoint> entryPoints,
            List<Entity> entities,
            List<Finding> findings,
            List<ConfigKey> configKeys,
            List<String> profiles,
            Stats stats
    ) {}
}
