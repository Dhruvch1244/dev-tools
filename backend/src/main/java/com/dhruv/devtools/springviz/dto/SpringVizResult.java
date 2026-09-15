package com.dhruv.devtools.springviz.dto;

import java.util.List;

public class SpringVizResult {

    public record Node(String id, String simpleName, String packageName, String kind, int endpointCount, String module, String project) {}

    public record Edge(String from, String to) {}

    public record Endpoint(String httpMethod, String path, String controllerClass, String methodName, String project) {}

    /** A cycle is the sequence of node ids that form the loop, e.g. [A, B, C, A]. */
    public record Cycle(List<String> path) {}

    public record Response(
            List<Node> nodes,
            List<Edge> edges,
            List<Endpoint> endpoints,
            String contextPath,
            Integer port,
            int javaFilesScanned,
            boolean workspace,
            List<String> projects,
            List<Cycle> cycles
    ) {}
}
