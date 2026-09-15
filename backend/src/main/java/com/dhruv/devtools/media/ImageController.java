package com.dhruv.devtools.media;

import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@RestController
@RequestMapping("/api/media/image")
public class ImageController {

    private final ImageProcessingService service;

    public ImageController(ImageProcessingService service) {
        this.service = service;
    }

    @PostMapping(value = "/convert", consumes = "multipart/form-data")
    public ResponseEntity<byte[]> convert(@RequestParam("file") MultipartFile file, @RequestParam("format") String format) throws IOException {
        var result = service.convert(file, format);
        return respond(result);
    }

    @PostMapping(value = "/enhance", consumes = "multipart/form-data")
    public ResponseEntity<byte[]> enhance(
            @RequestParam("file") MultipartFile file,
            @RequestParam(value = "brightness", defaultValue = "1.0") double brightness,
            @RequestParam(value = "contrast", defaultValue = "1.0") double contrast,
            @RequestParam(value = "sharpen", defaultValue = "false") boolean sharpen,
            @RequestParam(value = "scale", defaultValue = "1.0") double scale
    ) throws IOException {
        var result = service.enhance(file, new ImageProcessingService.EnhanceOptions(brightness, contrast, sharpen, scale));
        return respond(result);
    }

    @PostMapping(value = "/convert-batch", consumes = "multipart/form-data")
    public ResponseEntity<byte[]> convertBatch(@RequestParam("files") List<MultipartFile> files, @RequestParam("format") String format) throws IOException {
        return respondZip(files, f -> service.convert(f, format), "converted-images.zip");
    }

    @PostMapping(value = "/enhance-batch", consumes = "multipart/form-data")
    public ResponseEntity<byte[]> enhanceBatch(
            @RequestParam("files") List<MultipartFile> files,
            @RequestParam(value = "brightness", defaultValue = "1.0") double brightness,
            @RequestParam(value = "contrast", defaultValue = "1.0") double contrast,
            @RequestParam(value = "sharpen", defaultValue = "false") boolean sharpen,
            @RequestParam(value = "scale", defaultValue = "1.0") double scale
    ) throws IOException {
        var opts = new ImageProcessingService.EnhanceOptions(brightness, contrast, sharpen, scale);
        return respondZip(files, f -> service.enhance(f, opts), "enhanced-images.zip");
    }

    private interface Op {
        ImageProcessingService.Converted apply(MultipartFile file) throws IOException;
    }

    private ResponseEntity<byte[]> respondZip(List<MultipartFile> files, Op op, String zipName) throws IOException {
        if (files.isEmpty()) throw new IllegalArgumentException("Choose at least one image.");
        ByteArrayOutputStream buffer = new ByteArrayOutputStream();
        try (ZipOutputStream zip = new ZipOutputStream(buffer)) {
            for (MultipartFile file : files) {
                var result = op.apply(file);
                zip.putNextEntry(new ZipEntry(result.fileName()));
                zip.write(result.bytes());
                zip.closeEntry();
            }
        }
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType("application/zip"))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.attachment().filename(zipName).build().toString())
                .body(buffer.toByteArray());
    }

    private ResponseEntity<byte[]> respond(ImageProcessingService.Converted result) {
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(result.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, ContentDisposition.inline().filename(result.fileName()).build().toString())
                .body(result.bytes());
    }
}
