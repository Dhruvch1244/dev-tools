package com.dhruv.devtools.notes;

import com.dhruv.devtools.notes.model.NoteAttachment;
import com.dhruv.devtools.notes.repo.NoteAttachmentRepository;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.concurrent.TimeUnit;

@RestController
@RequestMapping("/api/notes/attachments")
public class NoteAttachmentController {

    private final NoteAttachmentRepository repository;

    public NoteAttachmentController(NoteAttachmentRepository repository) {
        this.repository = repository;
    }

    @PostMapping(consumes = "multipart/form-data")
    public Map<String, Object> upload(@RequestParam("file") MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("Uploaded file is empty.");
        NoteAttachment attachment = new NoteAttachment();
        attachment.setFileName(file.getOriginalFilename() == null ? "image" : file.getOriginalFilename());
        attachment.setContentType(file.getContentType() == null ? "application/octet-stream" : file.getContentType());
        attachment.setData(file.getBytes());
        NoteAttachment saved = repository.save(attachment);
        return Map.of("id", saved.getId(), "url", "/api/notes/attachments/" + saved.getId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<byte[]> get(@PathVariable Long id) {
        NoteAttachment attachment = repository.findById(id).orElseThrow(() -> new IllegalArgumentException("No such attachment: " + id));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .cacheControl(CacheControl.maxAge(30, TimeUnit.DAYS).cachePublic())
                .body(attachment.getData());
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        repository.deleteById(id);
    }
}
