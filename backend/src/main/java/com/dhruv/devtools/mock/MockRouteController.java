package com.dhruv.devtools.mock;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.web.bind.annotation.*;

import java.net.Inet4Address;
import java.net.InetAddress;
import java.net.NetworkInterface;
import java.util.*;

@RestController
@RequestMapping("/api/mock-routes")
public class MockRouteController {

    private final MockRouteService service;
    private final MockRequestLog requestLog;
    private final int port;

    public MockRouteController(MockRouteService service, MockRequestLog requestLog, @Value("${server.port:8080}") int port) {
        this.service = service;
        this.requestLog = requestLog;
        this.port = port;
    }

    @GetMapping
    public List<MockRoute> list() {
        return service.list();
    }

    @PostMapping
    public MockRoute create(@RequestBody MockRouteService.RouteSave req) {
        return service.create(req);
    }

    @PutMapping("/{id}")
    public MockRoute update(@PathVariable Long id, @RequestBody MockRouteService.RouteSave req) {
        return service.update(id, req);
    }

    @DeleteMapping("/{id}")
    public void delete(@PathVariable Long id) {
        service.delete(id);
    }

    public record ImportRequest(List<MockRouteService.RouteSave> routes, boolean replace) {}

    @PostMapping("/import")
    public Map<String, Integer> importRoutes(@RequestBody ImportRequest req) {
        return Map.of("imported", service.importAll(req.routes(), req.replace()));
    }

    @GetMapping("/log")
    public List<MockRequestLog.Entry> log(@RequestParam(defaultValue = "0") long after) {
        return requestLog.since(after);
    }

    @DeleteMapping("/log")
    public void clearLog() {
        requestLog.clear();
    }

    public record NetworkAddress(String interfaceName, String displayName, String address, String baseUrl) {}

    public record NetworkInfo(int port, String hostname, List<NetworkAddress> addresses) {}

    /**
     * Every IPv4 address this machine can be reached on from the LAN, so the UI can show a
     * phone-friendly URL (and QR code) instead of "localhost", which is meaningless on another device.
     * Virtual adapters (Docker, WSL, VirtualBox/VMware host-only, VPN tunnels) are listed last.
     */
    @GetMapping("/network")
    public NetworkInfo network() {
        List<NetworkAddress> real = new ArrayList<>();
        List<NetworkAddress> virtual = new ArrayList<>();
        try {
            for (NetworkInterface ni : Collections.list(NetworkInterface.getNetworkInterfaces())) {
                if (!ni.isUp() || ni.isLoopback()) continue;
                for (InetAddress addr : Collections.list(ni.getInetAddresses())) {
                    if (!(addr instanceof Inet4Address) || addr.isLinkLocalAddress()) continue;
                    String ip = addr.getHostAddress();
                    NetworkAddress na = new NetworkAddress(ni.getName(), ni.getDisplayName(), ip, "http://" + ip + ":" + port + "/mock");
                    (looksVirtual(ni) ? virtual : real).add(na);
                }
            }
        } catch (Exception ignored) {
            // No interfaces readable — the UI falls back to localhost only.
        }
        real.addAll(virtual);
        String hostname;
        try {
            hostname = InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            hostname = null;
        }
        return new NetworkInfo(port, hostname, real);
    }

    private boolean looksVirtual(NetworkInterface ni) {
        if (ni.isVirtual()) return true;
        String n = (ni.getName() + " " + ni.getDisplayName()).toLowerCase(Locale.ROOT);
        for (String marker : List.of("docker", "veth", "br-", "vbox", "virtualbox", "vmware", "vmnet", "wsl", "hyper-v", "vethernet", "tun", "tap", "utun", "zerotier", "tailscale", "wireguard", "loopback")) {
            if (n.contains(marker)) return true;
        }
        return false;
    }
}
