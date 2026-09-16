package com.dhruv.devtools.search;

/** One hit from a global search — `tool` is the frontend Tool id to open, `id` its record id within that tool. */
public record GlobalSearchResult(String tool, String type, String id, String title, String snippet) {
}
