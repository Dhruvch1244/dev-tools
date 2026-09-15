package com.dhruv.devtools.commands;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "command_template")
public class CommandTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String name;

    /** Raw command text with placeholders like &lt;source&gt; or &lt;source=./default.txt&gt;. */
    @Lob
    @Column(nullable = false)
    private String template;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public String getTemplate() { return template; }
    public void setTemplate(String template) { this.template = template; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
