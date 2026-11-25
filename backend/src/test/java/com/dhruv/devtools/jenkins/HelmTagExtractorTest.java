package com.dhruv.devtools.jenkins;

import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class HelmTagExtractorTest {

    @Test
    void prefersExplicitMarkerAndTakesLastOccurrence() {
        HelmTagExtractor ex = new HelmTagExtractor(null);
        ex.line("Successfully packaged chart and saved it to: /ws/order-service-1.2.3.tgz");
        ex.line("HELM_TAG=1.2.3-rc1");
        ex.line("[Pipeline] echo");
        ex.line("HELM_TAG=1.2.3-rc2");
        HelmTagExtractor.Result r = ex.result();
        assertEquals("1.2.3-rc2", r.best());
        assertTrue(r.bestSource().startsWith("HELM_TAG marker"));
    }

    @Test
    void parsesHelmUpgradeCommandLine() {
        HelmTagExtractor.Release rel = HelmTagExtractor.parseHelmCommand(
                "--install payments oci://reg/charts/payments --version 4.5.6 -n pay-uat -f values-uat.yaml --set image.tag=4.5.6-abc,replicas=2 --atomic", 7);
        assertEquals("payments", rel.release());
        assertEquals("oci://reg/charts/payments", rel.chart());
        assertEquals("4.5.6", rel.version());
        assertEquals("pay-uat", rel.namespace());
        assertEquals("4.5.6-abc", rel.imageTag());
    }

    @Test
    void stripsAnsiAndFallsBackToParameters() {
        HelmTagExtractor ex = new HelmTagExtractor(null);
        ex.line("\u001B[32mnothing useful here\u001B[0m");
        ex.parameters(Map.of("HELM_CHART_TAG", "9.9.9", "BRANCH", "main"));
        assertEquals("9.9.9", ex.result().best());
    }

    @Test
    void customPatternWithNamedGroupAndBadPatternReported() {
        HelmTagExtractor ex = new HelmTagExtractor(List.of(
                new HelmTagExtractor.PatternDef("release line", "Released (?<tag>v[\\d.]+) to"),
                new HelmTagExtractor.PatternDef("broken", "(unclosed")));
        ex.line("Released v7.1.0 to prod");
        HelmTagExtractor.Result r = ex.result();
        assertEquals("v7.1.0", r.best());
        assertEquals(1, r.patternErrors().size());
    }

    @Test
    void jobPathIsEncodedPerSegment() {
        assertEquals("job/team%20a/job/app/", JenkinsClient.jobUrlPath("team a/app"));
        assertEquals("job/a/job/b/", JenkinsClient.jobUrlPath("job/a/job/b"));
        assertEquals("", JenkinsClient.jobUrlPath(""));
    }
}
