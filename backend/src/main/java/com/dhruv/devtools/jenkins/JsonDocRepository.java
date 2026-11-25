package com.dhruv.devtools.jenkins;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface JsonDocRepository extends JpaRepository<JsonDoc, Long> {
    List<JsonDoc> findAllByKindOrderByUpdatedAtDesc(String kind);
}
