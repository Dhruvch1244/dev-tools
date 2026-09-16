package com.dhruv.devtools.javatools;

import com.dhruv.devtools.javatools.dto.JarInspectResult.DuplicateClass;
import com.dhruv.devtools.javatools.dto.JarInspectResult.JarSummary;
import com.dhruv.devtools.javatools.dto.JarInspectResult.LargestEntry;
import com.dhruv.devtools.javatools.dto.JarInspectResult.PackageCount;
import com.dhruv.devtools.javatools.dto.JarInspectResult.Response;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.*;
import java.util.jar.JarInputStream;
import java.util.jar.Manifest;
import java.util.zip.ZipEntry;

/**
 * Answers the two questions that come up constantly with a broken classpath: "what Java version
 * was this compiled for" (the class-file major version — the source of the classic "unsupported
 * class file major version" error) and "is this class defined in more than one jar" (the usual
 * root cause of a NoSuchMethodError/ClassNotFoundException that only shows up at runtime).
 */
@Service
public class JarInspectService {

    public Response inspect(List<MultipartFile> files) throws IOException {
        List<JarSummary> summaries = new ArrayList<>();
        // className -> set of jar file names it was found in, to spot duplicates across the classpath.
        Map<String, Set<String>> classLocations = new HashMap<>();

        for (MultipartFile file : files) {
            long entryCount = 0;
            long classCount = 0;
            long totalSize = 0;
            boolean signed = false;
            boolean multiRelease = false;
            Map<String, String> manifestAttrs = new LinkedHashMap<>();
            Map<Integer, Long> majorVersions = new TreeMap<>();
            Map<String, Long> resourceExtensions = new TreeMap<>();
            Map<String, Long> packageCounts = new TreeMap<>();
            List<LargestEntry> allEntries = new ArrayList<>();

            try (InputStream rawIn = file.getInputStream();
                 JarInputStream jarIn = new JarInputStream(rawIn)) {

                Manifest manifest = jarIn.getManifest();
                if (manifest != null) {
                    manifest.getMainAttributes().forEach((k, v) -> manifestAttrs.put(String.valueOf(k), String.valueOf(v)));
                    if ("true".equalsIgnoreCase(manifest.getMainAttributes().getValue("Multi-Release"))) multiRelease = true;
                }

                ZipEntry entry;
                while ((entry = jarIn.getNextEntry()) != null) {
                    entryCount++;
                    String name = entry.getName();
                    if (name.startsWith("META-INF/versions/")) multiRelease = true;
                    if (name.startsWith("META-INF/") && (name.endsWith(".SF") || name.endsWith(".RSA") || name.endsWith(".DSA"))) signed = true;
                    if (entry.isDirectory()) continue;

                    // entry.getSize() is frequently -1/unreliable when reading via the streaming
                    // JarInputStream API (depends on whether the zip's local header pre-declared
                    // sizes) — count actual bytes consumed instead, which is always correct.
                    long size;
                    if (name.endsWith(".class")) {
                        classCount++;
                        String className = name.replace('/', '.').replaceAll("\\.class$", "");
                        classLocations.computeIfAbsent(className, k -> new LinkedHashSet<>()).add(file.getOriginalFilename());
                        int lastDot = className.lastIndexOf('.');
                        String pkg = lastDot > 0 ? className.substring(0, lastDot) : "(default package)";
                        packageCounts.merge(pkg, 1L, Long::sum);

                        byte[] header = new byte[8];
                        int headerRead = jarIn.readNBytes(header, 0, 8);
                        Integer major = parseMajorVersion(header, headerRead);
                        if (major != null) majorVersions.merge(major, 1L, Long::sum);
                        size = headerRead + jarIn.transferTo(OutputStream.nullOutputStream());
                    } else {
                        int lastSlash = name.lastIndexOf('/');
                        String baseName = lastSlash >= 0 ? name.substring(lastSlash + 1) : name;
                        int lastDot = baseName.lastIndexOf('.');
                        String ext = lastDot > 0 ? baseName.substring(lastDot + 1).toLowerCase() : "(no extension)";
                        resourceExtensions.merge(ext, 1L, Long::sum);
                        size = jarIn.transferTo(OutputStream.nullOutputStream());
                    }
                    totalSize += size;
                    allEntries.add(new LargestEntry(name, size));
                }
            }

            List<LargestEntry> largest = allEntries.stream()
                    .sorted(Comparator.comparingLong(LargestEntry::size).reversed())
                    .limit(10)
                    .toList();
            List<PackageCount> topPackages = packageCounts.entrySet().stream()
                    .map(e -> new PackageCount(e.getKey(), e.getValue()))
                    .sorted(Comparator.comparingLong(PackageCount::classCount).reversed())
                    .limit(15)
                    .toList();

            summaries.add(new JarSummary(
                    file.getOriginalFilename(), entryCount, classCount, totalSize, manifestAttrs,
                    remapByJavaVersion(majorVersions), resourceExtensions, largest, topPackages, signed, multiRelease
            ));
        }

        List<DuplicateClass> duplicates = classLocations.entrySet().stream()
                .filter(e -> e.getValue().size() > 1)
                .map(e -> new DuplicateClass(e.getKey(), new ArrayList<>(e.getValue())))
                .sorted(Comparator.comparing(DuplicateClass::className))
                .toList();

        return new Response(summaries, duplicates);
    }

    /** Class file layout: 4-byte magic (0xCAFEBABE), 2-byte minor version, 2-byte major version. */
    private Integer parseMajorVersion(byte[] header, int bytesRead) {
        if (bytesRead < 8) return null;
        boolean magicOk = (header[0] & 0xFF) == 0xCA && (header[1] & 0xFF) == 0xFE
                && (header[2] & 0xFF) == 0xBA && (header[3] & 0xFF) == 0xBE;
        if (!magicOk) return null;
        return ((header[6] & 0xFF) << 8) | (header[7] & 0xFF);
    }

    private Map<String, Long> remapByJavaVersion(Map<Integer, Long> majorVersions) {
        Map<String, Long> out = new LinkedHashMap<>();
        majorVersions.forEach((major, count) -> out.put(describeMajorVersion(major), count));
        return out;
    }

    private String describeMajorVersion(int major) {
        // major = Java version + 44 for every version from Java 1.1 (major 45) onward — no gaps.
        String javaVersion = major >= 45 ? String.valueOf(major - 44) : "pre-1.1";
        return "Java " + javaVersion + " (major=" + major + ")";
    }
}
