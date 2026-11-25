package com.dhruv.devtools.jenkins;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface HelmTagRecordRepository extends JpaRepository<HelmTagRecord, Long> {
    List<HelmTagRecord> findAllByOrderByCapturedAtDesc();
}
