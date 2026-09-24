package com.dhruv.devtools.mock;

import org.springframework.stereotype.Component;

import java.time.Instant;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.atomic.AtomicLong;

/** In-memory ring buffer of recent /mock hits, so you can see what a phone or another laptop actually sent. */
@Component
public class MockRequestLog {

    private static final int CAPACITY = 200;
    private static final int MAX_BODY = 4000;

    public record Entry(long seq, Instant at, String method, String path, String query, String remoteAddr,
                        String userAgent, String origin, Long routeId, int status, long durationMs, String requestBody) {}

    private final Deque<Entry> entries = new ArrayDeque<>();
    private final AtomicLong seq = new AtomicLong();

    public synchronized void add(String method, String path, String query, String remoteAddr, String userAgent, String origin,
                                 Long routeId, int status, long durationMs, String body) {
        String trimmed = body == null ? null : (body.length() > MAX_BODY ? body.substring(0, MAX_BODY) + "…" : body);
        entries.addFirst(new Entry(seq.incrementAndGet(), Instant.now(), method, path, query, remoteAddr, userAgent, origin, routeId, status, durationMs, trimmed));
        while (entries.size() > CAPACITY) entries.removeLast();
    }

    /** Entries newer than {@code afterSeq}, newest first — lets the UI poll cheaply. */
    public synchronized List<Entry> since(long afterSeq) {
        List<Entry> out = new ArrayList<>();
        for (Entry e : entries) {
            if (e.seq() <= afterSeq) break;
            out.add(e);
        }
        return out;
    }

    public synchronized void clear() {
        entries.clear();
    }
}
