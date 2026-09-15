package com.dhruv.devtools.notes.repo;

import com.dhruv.devtools.notes.model.NoteAttachment;
import org.springframework.data.jpa.repository.JpaRepository;

public interface NoteAttachmentRepository extends JpaRepository<NoteAttachment, Long> {
}
