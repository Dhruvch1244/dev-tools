package com.dhruv.devtools.media;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import javax.imageio.ImageIO;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.awt.image.BufferedImageOp;
import java.awt.image.ConvolveOp;
import java.awt.image.Kernel;
import java.awt.image.RescaleOp;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.ArrayDeque;
import java.util.Set;

@Service
public class ImageProcessingService {

    private static final Set<String> SUPPORTED_FORMATS = Set.of("png", "jpg", "jpeg", "bmp", "gif", "webp");

    public record Converted(byte[] bytes, String contentType, String fileName) {}

    /** Re-encodes an uploaded image into a different container format (PNG/JPEG/BMP/GIF). */
    public Converted convert(MultipartFile file, String targetFormat) throws IOException {
        String format = normalizeFormat(targetFormat);
        BufferedImage image = read(file);

        // JPEG/BMP don't support alpha — flatten onto white first so transparent PNGs don't come out black.
        if ((format.equals("jpg") || format.equals("jpeg") || format.equals("bmp")) && image.getColorModel().hasAlpha()) {
            image = flatten(image);
        }

        byte[] bytes = encode(image, format);
        String baseName = stripExtension(file.getOriginalFilename());
        return new Converted(bytes, contentTypeFor(format), baseName + "." + format);
    }

    public record EnhanceOptions(double brightness, double contrast, boolean sharpen, double scale) {}

    /** Applies brightness/contrast/sharpen/resize, in that order (resize first so sharpen acts on final pixels). */
    public Converted enhance(MultipartFile file, EnhanceOptions opts) throws IOException {
        BufferedImage image = read(file);

        if (opts.scale() > 0 && Math.abs(opts.scale() - 1.0) > 0.001) {
            image = scale(image, opts.scale());
        }

        if (Math.abs(opts.brightness() - 1.0) > 0.001 || Math.abs(opts.contrast() - 1.0) > 0.001) {
            image = adjustBrightnessContrast(image, opts.brightness(), opts.contrast());
        }

        if (opts.sharpen()) {
            image = sharpen(image);
        }

        String format = file.getOriginalFilename() != null && file.getOriginalFilename().toLowerCase().endsWith(".png") ? "png" : "jpg";
        byte[] bytes = encode(image, format);
        String baseName = stripExtension(file.getOriginalFilename());
        return new Converted(bytes, contentTypeFor(format), baseName + "-enhanced." + format);
    }

    public record ColorRemoveOptions(String hexColor, int tolerance, boolean edgesOnly) {}

    /**
     * Classical (non-ML) background removal: makes pixels matching `hexColor` within `tolerance`
     * transparent. `edgesOnly` (the safer default) flood-fills inward from the four image borders
     * so only the connected background region is removed — a subject wearing the same color won't
     * get holes punched in it the way a naive "remove every matching pixel anywhere" would.
     */
    public Converted removeColor(MultipartFile file, ColorRemoveOptions opts) throws IOException {
        BufferedImage src = read(file);
        int w = src.getWidth();
        int h = src.getHeight();
        int target = parseHexColor(opts.hexColor());
        int tr = (target >> 16) & 0xFF;
        int tg = (target >> 8) & 0xFF;
        int tb = target & 0xFF;
        double maxDist = Math.sqrt(3 * 255.0 * 255.0);
        double threshold = Math.max(0, Math.min(100, opts.tolerance())) / 100.0 * maxDist;

        int[] pixels = src.getRGB(0, 0, w, h, null, 0, w);
        BufferedImage out = new BufferedImage(w, h, BufferedImage.TYPE_INT_ARGB);
        out.setRGB(0, 0, w, h, pixels, 0, w);

        if (opts.edgesOnly()) {
            boolean[] visited = new boolean[w * h];
            boolean[] queued = new boolean[w * h];
            ArrayDeque<int[]> queue = new ArrayDeque<>();
            for (int x = 0; x < w; x++) {
                queue.add(new int[]{x, 0});
                queue.add(new int[]{x, h - 1});
            }
            for (int y = 0; y < h; y++) {
                queue.add(new int[]{0, y});
                queue.add(new int[]{w - 1, y});
            }
            while (!queue.isEmpty()) {
                int[] p = queue.poll();
                int x = p[0];
                int y = p[1];
                if (x < 0 || x >= w || y < 0 || y >= h) continue;
                int idx = y * w + x;
                if (visited[idx]) continue;
                visited[idx] = true;

                int px = pixels[idx];
                int r = (px >> 16) & 0xFF;
                int g = (px >> 8) & 0xFF;
                int b = px & 0xFF;
                if (colorDistance(r, g, b, tr, tg, tb) > threshold) continue;

                out.setRGB(x, y, (r << 16) | (g << 8) | b); // alpha 0
                int[][] neighbors = {{x + 1, y}, {x - 1, y}, {x, y + 1}, {x, y - 1}};
                for (int[] n : neighbors) {
                    int nx = n[0];
                    int ny = n[1];
                    if (nx < 0 || nx >= w || ny < 0 || ny >= h) continue;
                    int nIdx = ny * w + nx;
                    if (!visited[nIdx] && !queued[nIdx]) {
                        queued[nIdx] = true;
                        queue.add(n);
                    }
                }
            }
        } else {
            for (int y = 0; y < h; y++) {
                for (int x = 0; x < w; x++) {
                    int idx = y * w + x;
                    int px = pixels[idx];
                    int r = (px >> 16) & 0xFF;
                    int g = (px >> 8) & 0xFF;
                    int b = px & 0xFF;
                    if (colorDistance(r, g, b, tr, tg, tb) <= threshold) {
                        out.setRGB(x, y, (r << 16) | (g << 8) | b);
                    }
                }
            }
        }

        byte[] bytes = encode(out, "png");
        String baseName = stripExtension(file.getOriginalFilename());
        return new Converted(bytes, "image/png", baseName + "-nobg.png");
    }

    private double colorDistance(int r1, int g1, int b1, int r2, int g2, int b2) {
        return Math.sqrt(sq(r1 - r2) + sq(g1 - g2) + sq(b1 - b2));
    }

    private double sq(int v) {
        return (double) v * v;
    }

    private int parseHexColor(String hex) {
        String h = hex == null ? "" : hex.trim().replace("#", "");
        if (h.length() == 3) {
            h = "" + h.charAt(0) + h.charAt(0) + h.charAt(1) + h.charAt(1) + h.charAt(2) + h.charAt(2);
        }
        if (h.length() != 6) throw new IllegalArgumentException("Invalid hex color '" + hex + "'.");
        try {
            return Integer.parseInt(h, 16);
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Invalid hex color '" + hex + "'.");
        }
    }

    private BufferedImage read(MultipartFile file) throws IOException {
        if (file.isEmpty()) throw new IllegalArgumentException("Uploaded file is empty.");
        BufferedImage image = ImageIO.read(file.getInputStream());
        if (image == null) throw new IllegalArgumentException("Could not decode '" + file.getOriginalFilename() + "' as an image.");
        return image;
    }

    private String normalizeFormat(String format) {
        String f = format == null ? "" : format.trim().toLowerCase();
        if (!SUPPORTED_FORMATS.contains(f)) {
            throw new IllegalArgumentException("Unsupported target format '" + format + "' (use png, jpg, bmp, gif, or webp).");
        }
        return f.equals("jpeg") ? "jpg" : f;
    }

    private BufferedImage flatten(BufferedImage src) {
        BufferedImage flat = new BufferedImage(src.getWidth(), src.getHeight(), BufferedImage.TYPE_INT_RGB);
        Graphics2D g = flat.createGraphics();
        g.setColor(Color.WHITE);
        g.fillRect(0, 0, src.getWidth(), src.getHeight());
        g.drawImage(src, 0, 0, null);
        g.dispose();
        return flat;
    }

    private BufferedImage scale(BufferedImage src, double factor) {
        int w = Math.max(1, (int) Math.round(src.getWidth() * factor));
        int h = Math.max(1, (int) Math.round(src.getHeight() * factor));
        BufferedImage dst = new BufferedImage(w, h, src.getColorModel().hasAlpha() ? BufferedImage.TYPE_INT_ARGB : BufferedImage.TYPE_INT_RGB);
        Graphics2D g = dst.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(src, 0, 0, w, h, null);
        g.dispose();
        return dst;
    }

    /** brightness/contrast as user-facing multipliers around 1.0 (0.5 = darker/flatter, 2.0 = brighter/punchier). */
    private BufferedImage adjustBrightnessContrast(BufferedImage src, double brightness, double contrast) {
        BufferedImage rgb = flatten(src);
        float scaleFactor = (float) contrast;
        float offset = (float) ((brightness - 1.0) * 255);
        RescaleOp op = new RescaleOp(scaleFactor, offset, null);
        BufferedImageOp safeOp = op;
        BufferedImage dst = new BufferedImage(rgb.getWidth(), rgb.getHeight(), BufferedImage.TYPE_INT_RGB);
        safeOp.filter(rgb, dst);
        return dst;
    }

    private BufferedImage sharpen(BufferedImage src) {
        float[] kernelData = {
            0f, -1f, 0f,
            -1f, 5f, -1f,
            0f, -1f, 0f,
        };
        ConvolveOp op = new ConvolveOp(new Kernel(3, 3, kernelData), ConvolveOp.EDGE_NO_OP, null);
        BufferedImage safeSrc = src.getColorModel().hasAlpha() ? flatten(src) : src;
        BufferedImage dst = new BufferedImage(safeSrc.getWidth(), safeSrc.getHeight(), BufferedImage.TYPE_INT_RGB);
        op.filter(safeSrc, dst);
        return dst;
    }

    private byte[] encode(BufferedImage image, String format) throws IOException {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        if (!ImageIO.write(image, format, out)) {
            throw new IllegalArgumentException("No writer available for format '" + format + "'.");
        }
        return out.toByteArray();
    }

    private String contentTypeFor(String format) {
        return switch (format) {
            case "jpg", "jpeg" -> "image/jpeg";
            case "bmp" -> "image/bmp";
            case "gif" -> "image/gif";
            case "webp" -> "image/webp";
            default -> "image/png";
        };
    }

    private String stripExtension(String name) {
        if (name == null || name.isBlank()) return "image";
        int dot = name.lastIndexOf('.');
        return dot > 0 ? name.substring(0, dot) : name;
    }
}
