package com.dhruv.devtools.apiclient;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ApiCollectionRepository extends JpaRepository<ApiCollection, Long> {
    List<ApiCollection> findAllByOrderByNameAsc();
}
