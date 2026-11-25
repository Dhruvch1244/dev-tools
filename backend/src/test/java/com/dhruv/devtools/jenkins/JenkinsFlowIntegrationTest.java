package com.dhruv.devtools.jenkins;

import com.fasterxml.jackson.databind.JsonNode;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Drives the real Jenkins REST client end to end against the built-in demo Jenkins (served by the
 * same app): trigger a parameterized CD build, follow the queue item to a build number, wait for
 * the approval gate, Proceed with an input parameter (CSRF crumb + submit), wait for SUCCESS, then
 * extract the Helm tag from the console.
 */
@SpringBootTest(
        webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT,
        properties = {"spring.datasource.url=jdbc:h2:mem:jenkins-it;DB_CLOSE_DELAY=-1"})
class JenkinsFlowIntegrationTest {

    @Autowired
    TestRestTemplate http;

    private JsonNode build(long server, int n) {
        return http.getForObject("/api/jenkins/servers/" + server + "/build?path=platform/order-service-cd&number=" + n, JsonNode.class);
    }

    @Test
    void triggerProceedAndExtractHelmTag() throws Exception {
        JsonNode server = http.postForObject("/api/jenkins/servers/demo", null, JsonNode.class);
        long id = server.get("id").asLong();

        JsonNode who = http.postForObject("/api/jenkins/servers/" + id + "/test", null, JsonNode.class);
        assertEquals("Demo User", who.get("user").asText());

        JsonNode q = http.postForObject("/api/jenkins/servers/" + id + "/trigger",
                Map.of("path", "platform/order-service-cd", "params", Map.of("ENV", "PROD", "VERSION", "2.0.7"), "parameterized", true),
                JsonNode.class);
        long queueId = q.get("queueId").asLong();

        int number = -1;
        for (int i = 0; i < 30 && number < 0; i++) {
            JsonNode item = http.getForObject("/api/jenkins/servers/" + id + "/queue/" + queueId, JsonNode.class);
            if (item.hasNonNull("buildNumber")) number = item.get("buildNumber").asInt();
            else Thread.sleep(300);
        }
        assertTrue(number > 0, "queue item never became a build");

        JsonNode b = null;
        for (int i = 0; i < 60; i++) {
            b = build(id, number);
            if (b.get("pendingInputs").size() > 0) break;
            Thread.sleep(300);
        }
        assertNotNull(b);
        JsonNode input = b.get("pendingInputs").get(0);
        assertTrue(input.get("message").asText().contains("PROD"));
        assertEquals("CHANGE_REF", input.get("inputs").get(0).get("name").asText());

        http.postForObject("/api/jenkins/servers/" + id + "/input",
                Map.of("path", "platform/order-service-cd", "number", number, "inputId", input.get("id").asText(),
                        "action", "proceed", "params", Map.of("CHANGE_REF", "CHG-42")),
                JsonNode.class);

        for (int i = 0; i < 60; i++) {
            b = build(id, number);
            if (!b.get("building").asBoolean()) break;
            Thread.sleep(300);
        }
        assertEquals("SUCCESS", b.get("result").asText());

        JsonNode log = http.getForObject("/api/jenkins/servers/" + id + "/log?path=platform/order-service-cd&number=" + number + "&start=0", JsonNode.class);
        assertTrue(log.get("text").asText().contains("Approved by Demo User {CHANGE_REF=CHG-42}"));

        JsonNode helm = http.postForObject("/api/jenkins/servers/" + id + "/helm-tag",
                Map.of("path", "platform/order-service-cd", "number", number), JsonNode.class);
        assertEquals("2.0.7-prod." + number, helm.get("best").asText());
        assertEquals("order-service", helm.get("releases").get(0).get("release").asText());
        assertEquals("order-prod", helm.get("releases").get(0).get("namespace").asText());
    }
}
