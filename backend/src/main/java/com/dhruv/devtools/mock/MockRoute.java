package com.dhruv.devtools.mock;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "mock_route")
public class MockRoute {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 10)
    private String method;

    /** e.g. "/users/{id}" — {name} segments match anything and aren't otherwise interpreted. */
    @Column(nullable = false, length = 500)
    private String path;

    @Column(nullable = false)
    private int status = 200;

    @Lob
    private String responseBody;

    @Column(length = 100)
    private String contentType = "application/json";

    @Column(nullable = false)
    private int delayMs = 0;

    @Column(nullable = false)
    private boolean enabled = true;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getMethod() { return method; }
    public void setMethod(String method) { this.method = method; }
    public String getPath() { return path; }
    public void setPath(String path) { this.path = path; }
    public int getStatus() { return status; }
    public void setStatus(int status) { this.status = status; }
    public String getResponseBody() { return responseBody; }
    public void setResponseBody(String responseBody) { this.responseBody = responseBody; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public int getDelayMs() { return delayMs; }
    public void setDelayMs(int delayMs) { this.delayMs = delayMs; }
    public boolean isEnabled() { return enabled; }
    public void setEnabled(boolean enabled) { this.enabled = enabled; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
