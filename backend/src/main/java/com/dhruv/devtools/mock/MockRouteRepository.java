package com.dhruv.devtools.mock;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MockRouteRepository extends JpaRepository<MockRoute, Long> {
    List<MockRoute> findAllByOrderByPathAsc();
    List<MockRoute> findAllByEnabledTrue();
}
