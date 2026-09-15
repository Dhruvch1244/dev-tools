package com.dhruv.devtools.notes.model;

import jakarta.persistence.*;
import java.time.Instant;

/**
 * Image bytes for notes, stored out-of-line and referenced from the markdown body as
 * `![alt](/api/notes/attachments/{id})` instead of an inline base64 data-URI — keeps the note's
 * raw markdown text small and readable regardless of how many/large the embedded images are.
 */
@Entity
@Table(name = "note_attachment")
public class NoteAttachment {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String fileName;

    @Column(nullable = false, length = 100)
    private String contentType;

    @Lob
    @Column(nullable = false)
    private byte[] data;

    @Column(nullable = false)
    private Instant createdAt;

    @PrePersist
    void onCreate() {
        if (createdAt == null) createdAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getFileName() { return fileName; }
    public void setFileName(String fileName) { this.fileName = fileName; }
    public String getContentType() { return contentType; }
    public void setContentType(String contentType) { this.contentType = contentType; }
    public byte[] getData() { return data; }
    public void setData(byte[] data) { this.data = data; }
    public Instant getCreatedAt() { return createdAt; }
    public void setCreatedAt(Instant createdAt) { this.createdAt = createdAt; }
}
