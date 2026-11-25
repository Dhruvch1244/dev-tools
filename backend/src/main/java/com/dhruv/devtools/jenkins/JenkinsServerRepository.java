package com.dhruv.devtools.jenkins;

import org.springframework.data.jpa.repository.JpaRepository;

public interface JenkinsServerRepository extends JpaRepository<JenkinsServer, Long> {
}
