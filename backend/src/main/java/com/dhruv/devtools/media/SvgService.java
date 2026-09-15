package com.dhruv.devtools.media;

import org.springframework.stereotype.Service;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NamedNodeMap;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import javax.xml.transform.OutputKeys;
import javax.xml.transform.Transformer;
import javax.xml.transform.TransformerFactory;
import javax.xml.transform.dom.DOMSource;
import javax.xml.transform.stream.StreamResult;
import java.io.ByteArrayInputStream;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@Service
public class SvgService {

    public record OptimizedSvg(String svg, int originalBytes, int optimizedBytes) {}

    private static final Pattern DECIMAL = Pattern.compile("-?\\d+\\.\\d{3,}");
    private static final Pattern EDITOR_NS_ATTR = Pattern.compile("^(inkscape|sodipodi):.*");

    /** Strips comments/editor metadata via DOM (structurally safe) and rounds long decimals via regex (a standard, safe SVGO-style optimization). */
    public OptimizedSvg optimize(String rawSvg) {
        if (rawSvg == null || rawSvg.isBlank()) throw new IllegalArgumentException("No SVG content provided.");
        int originalBytes = rawSvg.getBytes(StandardCharsets.UTF_8).length;

        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setExpandEntityReferences(false);
            DocumentBuilder builder = factory.newDocumentBuilder();
            Document doc = builder.parse(new ByteArrayInputStream(rawSvg.getBytes(StandardCharsets.UTF_8)));

            if (doc.getDocumentElement() == null || !doc.getDocumentElement().getTagName().equalsIgnoreCase("svg")) {
                throw new IllegalArgumentException("Not a valid SVG document.");
            }

            stripCommentsAndEditorCruft(doc.getDocumentElement());

            Transformer transformer = TransformerFactory.newInstance().newTransformer();
            transformer.setOutputProperty(OutputKeys.OMIT_XML_DECLARATION, "yes");
            transformer.setOutputProperty(OutputKeys.METHOD, "xml");
            StringWriter writer = new StringWriter();
            transformer.transform(new DOMSource(doc), new StreamResult(writer));

            String minified = writer.toString()
                    .replaceAll(">\\s+<", "><")
                    .replaceAll("\\s{2,}", " ")
                    .trim();
            minified = roundNumbers(minified);

            int optimizedBytes = minified.getBytes(StandardCharsets.UTF_8).length;
            return new OptimizedSvg(minified, originalBytes, optimizedBytes);
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Could not parse SVG: " + e.getMessage(), e);
        }
    }

    private void stripCommentsAndEditorCruft(Node node) {
        List<Node> toRemove = new ArrayList<>();
        NodeList children = node.getChildNodes();
        for (int i = 0; i < children.getLength(); i++) {
            Node child = children.item(i);
            if (child.getNodeType() == Node.COMMENT_NODE) {
                toRemove.add(child);
                continue;
            }
            if (child.getNodeType() == Node.ELEMENT_NODE) {
                Element el = (Element) child;
                String tag = el.getTagName();
                if (tag.equalsIgnoreCase("metadata") || tag.equalsIgnoreCase("sodipodi:namedview")) {
                    toRemove.add(child);
                    continue;
                }
                stripEditorAttributes(el);
                stripCommentsAndEditorCruft(el);
            }
        }
        for (Node n : toRemove) node.removeChild(n);
    }

    private void stripEditorAttributes(Element el) {
        NamedNodeMap attrs = el.getAttributes();
        List<String> toRemove = new ArrayList<>();
        for (int i = 0; i < attrs.getLength(); i++) {
            String name = attrs.item(i).getNodeName();
            if (EDITOR_NS_ATTR.matcher(name).matches()) toRemove.add(name);
        }
        for (String name : toRemove) el.removeAttribute(name);
    }

    private String roundNumbers(String svg) {
        Matcher m = DECIMAL.matcher(svg);
        StringBuilder sb = new StringBuilder();
        while (m.find()) {
            double v = Double.parseDouble(m.group());
            String rounded = trimTrailingZeros(String.format(Locale.ROOT, "%.2f", v));
            m.appendReplacement(sb, Matcher.quoteReplacement(rounded));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private String trimTrailingZeros(String s) {
        if (!s.contains(".")) return s;
        s = s.replaceAll("0+$", "");
        if (s.endsWith(".")) s = s.substring(0, s.length() - 1);
        return s;
    }
}
