package com.dhruv.devtools.javatools.dto;

import java.util.List;
import java.util.Map;

public class JarInspectResult {

    public record LargestEntry(String name, long size) {}
    public record PackageCount(String packageName, long classCount) {}

    public record JarSummary(
            String fileName,
            long entryCount,
            long classCount,
            long totalUncompressedSize,
            Map<String, String> manifestMainAttributes,
            Map<String, Long> classMajorVersions,
            Map<String, Long> resourcesByExtension,
            List<LargestEntry> largestEntries,
            List<PackageCount> topPackages,
            boolean signed,
            boolean multiRelease
    ) {}

    public record DuplicateClass(String className, List<String> foundInJars) {}

    public record Response(List<JarSummary> jars, List<DuplicateClass> duplicateClasses) {}
}
