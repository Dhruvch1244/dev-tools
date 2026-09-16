package com.dhruv.devtools.apiclient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiEnvironmentRepository extends JpaRepository<ApiEnvironment, Long> {
    List<ApiEnvironment> findAllByCollectionIdOrderByNameAsc(Long collectionId);
    void deleteAllByCollectionId(Long collectionId);
}
