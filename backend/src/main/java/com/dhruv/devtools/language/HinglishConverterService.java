package com.dhruv.devtools.language;

import com.dhruv.devtools.dto.HinglishConvertResult;
import com.dhruv.devtools.dto.LanguageStat;
import com.dhruv.devtools.dto.WordBreakdownItem;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Heuristic, offline converter for romanized Indian-language text ("Hinglish", "Tanglish",
 * "Tenglish", and the Kannada/Malayalam/Punjabi/Marathi/Gujarati/Bengali equivalents) into
 * plain English and Hindi (Devanagari). Dictionary/lookup based, not a full translator: words
 * it doesn't recognize are passed through unchanged.
 */
@Service
public class HinglishConverterService {

    private static final Pattern TOKEN_PARTS = Pattern.compile("^([^A-Za-z']*)([A-Za-z']*)([^A-Za-z']*)$");

    public HinglishConvertResult convert(String rawInput) {
        String input = rawInput == null ? "" : rawInput;
        List<WordBreakdownItem> breakdown = new ArrayList<>();
        Map<IndianLanguage, Integer> languageCounts = new LinkedHashMap<>();
        int totalWords = 0;
        int recognizedCount = 0;

        List<String> englishLines = new ArrayList<>();
        List<String> hindiLines = new ArrayList<>();

        for (String line : input.split("\n", -1)) {
            if (line.isBlank()) {
                englishLines.add(line);
                hindiLines.add(line);
                continue;
            }

            String[] rawTokens = line.trim().split("\\s+");
            TokenParts[] parts = new TokenParts[rawTokens.length];
            for (int i = 0; i < rawTokens.length; i++) {
                parts[i] = splitToken(rawTokens[i]);
            }

            List<String> englishOut = new ArrayList<>();
            List<String> hindiOut = new ArrayList<>();

            int i = 0;
            while (i < parts.length) {
                if (parts[i].core.isEmpty()) {
                    englishOut.add(rawTokens[i]);
                    hindiOut.add(rawTokens[i]);
                    i++;
                    continue;
                }

                int matchedWindow = 0;
                PhraseEntry matchedEntry = null;
                int maxWindow = Math.min(HinglishDictionary.MAX_PHRASE_WORDS, parts.length - i);
                for (int window = maxWindow; window >= 1; window--) {
                    StringBuilder key = new StringBuilder();
                    boolean allCore = true;
                    for (int j = i; j < i + window; j++) {
                        if (parts[j].core.isEmpty()) {
                            allCore = false;
                            break;
                        }
                        if (key.length() > 0) key.append(' ');
                        key.append(parts[j].core.toLowerCase());
                    }
                    if (!allCore) continue;
                    PhraseEntry entry = HinglishDictionary.LOOKUP.get(key.toString());
                    if (entry != null) {
                        matchedWindow = window;
                        matchedEntry = entry;
                        break;
                    }
                }

                totalWords++;
                if (matchedEntry != null) {
                    recognizedCount += matchedWindow;
                    totalWords += matchedWindow - 1;

                    String prefix = parts[i].prefix;
                    String suffix = parts[i + matchedWindow - 1].suffix;
                    englishOut.add(prefix + matchedEntry.english() + suffix);
                    hindiOut.add(prefix + matchedEntry.hindi() + suffix);

                    StringBuilder original = new StringBuilder();
                    for (int j = i; j < i + matchedWindow; j++) {
                        if (original.length() > 0) original.append(' ');
                        original.append(rawTokens[j]);
                    }
                    breakdown.add(new WordBreakdownItem(
                            original.toString(),
                            matchedEntry.language().displayName(),
                            matchedEntry.language().isSouth(),
                            matchedEntry.english(),
                            matchedEntry.hindi()
                    ));
                    languageCounts.merge(matchedEntry.language(), 1, Integer::sum);
                    i += matchedWindow;
                } else {
                    englishOut.add(rawTokens[i]);
                    hindiOut.add(rawTokens[i]);
                    i++;
                }
            }

            englishLines.add(capitalize(String.join(" ", englishOut)));
            hindiLines.add(String.join(" ", hindiOut));
        }

        List<LanguageStat> stats = languageCounts.entrySet().stream()
                .sorted((a, b) -> b.getValue() - a.getValue())
                .map(en -> new LanguageStat(en.getKey().displayName(), en.getKey().isSouth(), en.getValue()))
                .toList();

        return new HinglishConvertResult(
                String.join("\n", englishLines),
                String.join("\n", hindiLines),
                breakdown,
                stats,
                recognizedCount,
                totalWords
        );
    }

    private TokenParts splitToken(String raw) {
        Matcher m = TOKEN_PARTS.matcher(raw);
        if (m.matches()) {
            return new TokenParts(m.group(1), m.group(2), m.group(3));
        }
        return new TokenParts("", raw, "");
    }

    private String capitalize(String s) {
        if (s.isEmpty()) return s;
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private record TokenParts(String prefix, String core, String suffix) {}
}
