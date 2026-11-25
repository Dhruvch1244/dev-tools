package com.dhruv.devtools.jenkins;

import com.fasterxml.jackson.annotation.JsonIgnore;
import com.fasterxml.jackson.annotation.JsonProperty;
import jakarta.persistence.*;

import java.time.Instant;

/** A Jenkins controller this app can talk to: base URL plus a user's API token (basic auth). */
@Entity
@Table(name = "jenkins_server")
public class JenkinsServer {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(nullable = false, length = 1000)
    private String baseUrl;

    @Column(length = 200)
    private String username;

    /** Never serialized back to the browser — only {@link #isHasToken()} is. */
    @Lob
    private String apiToken;

    /** For internal Jenkins instances behind a self-signed certificate. */
    private boolean trustAllCerts;

    private boolean demo;

    @Column(nullable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    @PrePersist
    void onCreate() {
        Instant now = Instant.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void onUpdate() {
        updatedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBaseUrl() { return baseUrl; }
    public void setBaseUrl(String baseUrl) { this.baseUrl = baseUrl; }
    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }
    @JsonIgnore
    public String getApiToken() { return apiToken; }
    @JsonIgnore
    public void setApiToken(String apiToken) { this.apiToken = apiToken; }
    @JsonProperty("hasToken")
    public boolean isHasToken() { return apiToken != null && !apiToken.isBlank(); }
    public boolean isTrustAllCerts() { return trustAllCerts; }
    public void setTrustAllCerts(boolean trustAllCerts) { this.trustAllCerts = trustAllCerts; }
    public boolean isDemo() { return demo; }
    public void setDemo(boolean demo) { this.demo = demo; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
