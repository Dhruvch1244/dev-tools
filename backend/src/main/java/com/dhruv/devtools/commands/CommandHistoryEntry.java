package com.dhruv.devtools.commands;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "command_history_entry")
public class CommandHistoryEntry {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    /** Snapshot of the template's name at generation time — not a foreign key, so history survives template deletion/edits. */
    @Column(nullable = false, length = 200)
    private String templateName;

    @Lob
    @Column(nullable = false)
    private String renderedCommand;

    /** JSON object of {placeholderName: value} used to generate this entry — lets "re-run" restore the exact fields, not just the flattened text. */
    @Lob
    private String valuesJson;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTemplateName() { return templateName; }
    public void setTemplateName(String templateName) { this.templateName = templateName; }
    public String getRenderedCommand() { return renderedCommand; }
    public void setRenderedCommand(String renderedCommand) { this.renderedCommand = renderedCommand; }
    public String getValuesJson() { return valuesJson; }
    public void setValuesJson(String valuesJson) { this.valuesJson = valuesJson; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
