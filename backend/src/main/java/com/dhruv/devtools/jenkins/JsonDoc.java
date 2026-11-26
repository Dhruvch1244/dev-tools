package com.dhruv.devtools.jenkins;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * A named JSON document owned by the frontend — release flows and rehydration snapshots. The
 * shape lives in the UI (it evolves faster than a table schema should); the backend just keeps it.
 */
@Entity
@Table(name = "jenkins_doc", indexes = @Index(columnList = "kind"))
public class JsonDoc {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** "flow" or "snapshot". */
    @Column(nullable = false, length = 40)
    private String kind;

    @Column(nullable = false, length = 300)
    private String name;

    @Lob
    @Column(nullable = false)
    private String body;

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
    public String getKind() { return kind; }
    public void setKind(String kind) { this.kind = kind; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getBody() { return body; }
    public void setBody(String body) { this.body = body; }
    public Instant getCreatedAt() { return createdAt; }
    public Instant getUpdatedAt() { return updatedAt; }
}
