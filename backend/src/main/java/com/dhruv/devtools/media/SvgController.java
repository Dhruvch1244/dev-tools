package com.dhruv.devtools.media;

import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/media/svg")
public class SvgController {

    private final SvgService service;

    public SvgController(SvgService service) {
        this.service = service;
    }

    public record OptimizeRequest(String svg) {}

    @PostMapping("/optimize")
    public SvgService.OptimizedSvg optimize(@RequestBody OptimizeRequest request) {
        return service.optimize(request.svg());
    }
}
