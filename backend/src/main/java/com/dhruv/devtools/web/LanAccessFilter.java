package com.dhruv.devtools.web;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.net.InetAddress;
import java.net.NetworkInterface;

/**
 * The server listens on every interface so the Mock Server is reachable from phones and other
 * machines on the LAN — but everything else in this app (Vault secrets, file search, git
 * checkout, SQL connections…) is strictly for the person sitting at this machine. Requests from
 * any other device may only reach /mock/**; the rest gets a 403 with an explanation.
 *
 * Set devtools.lan.full-access=true to opt out (e.g. to use the whole UI from a second machine
 * you trust on a private network).
 */
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class LanAccessFilter extends OncePerRequestFilter {

    private final boolean fullAccess;

    public LanAccessFilter(@Value("${devtools.lan.full-access:false}") boolean fullAccess) {
        this.fullAccess = fullAccess;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        if (fullAccess) return true;
        String path = request.getRequestURI().substring(request.getContextPath().length());
        return path.equals("/mock") || path.startsWith("/mock/");
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain chain)
            throws ServletException, IOException {
        if (isThisMachine(request.getRemoteAddr())) {
            chain.doFilter(request, response);
            return;
        }
        response.setStatus(HttpServletResponse.SC_FORBIDDEN);
        response.setContentType("application/json");
        response.setCharacterEncoding("UTF-8");
        response.getWriter().write("{\"error\":\"Dev Tools only shares /mock/** with other devices on the network. "
                + "Open the app on the machine running it, or start it with --devtools.lan.full-access=true to allow full remote access.\"}");
    }

    /** Loopback, or one of this machine's own interface addresses (e.g. opening http://192.168.1.5:8383 locally). */
    static boolean isThisMachine(String remoteAddr) {
        if (remoteAddr == null) return false;
        try {
            InetAddress addr = InetAddress.getByName(remoteAddr); // an IP literal — no DNS lookup happens
            return addr.isLoopbackAddress() || addr.isAnyLocalAddress() || NetworkInterface.getByInetAddress(addr) != null;
        } catch (Exception e) {
            return false;
        }
    }
}
