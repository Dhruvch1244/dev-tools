package com.dhruv.devtools.apiclient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiRequestDefRepository extends JpaRepository<ApiRequestDef, Long> {
    List<ApiRequestDef> findAllByCollectionIdOrderByNameAsc(Long collectionId);
    void deleteAllByCollectionId(Long collectionId);
}
