package com.dhruv.devtools.commands;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommandHistoryRepository extends JpaRepository<CommandHistoryEntry, Long> {
    List<CommandHistoryEntry> findAllByOrderByCreatedAtDesc();
}
