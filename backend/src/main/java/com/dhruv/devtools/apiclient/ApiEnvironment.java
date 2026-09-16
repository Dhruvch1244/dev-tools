package com.dhruv.devtools.apiclient;

import jakarta.persistence.*;
import java.time.Instant;

/** A named set of {{variable}} substitutions scoped to one collection (e.g. "Dev", "Staging", "Prod"). */
@Entity
@Table(name = "api_environment")
public class ApiEnvironment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long collectionId;

    @Column(nullable = false, length = 200)
    private String name;

    /** JSON object of {varName: value} — kept as raw text, parsed/serialized on the frontend. */
    @Lob
    @Column(nullable = false)
    private String variablesJson;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getCollectionId() { return collectionId; }
    public void setCollectionId(Long collectionId) { this.collectionId = collectionId; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getVariablesJson() { return variablesJson; }
    public void setVariablesJson(String variablesJson) { this.variablesJson = variablesJson; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
