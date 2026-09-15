package com.dhruv.devtools.commands;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CommandTemplateRepository extends JpaRepository<CommandTemplate, Long> {
    List<CommandTemplate> findAllByOrderByNameAsc();
}
