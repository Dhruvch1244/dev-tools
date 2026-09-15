package com.dhruv.devtools.gitrepo;

import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SavedGitRepoRepository extends JpaRepository<SavedGitRepo, Long> {
    List<SavedGitRepo> findAllByOrderByLabelAsc();
}
