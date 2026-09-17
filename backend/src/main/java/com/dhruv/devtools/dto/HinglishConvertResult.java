package com.dhruv.devtools.dto;

import java.util.List;

public record HinglishConvertResult(
        String plainEnglish,
        String hindi,
        List<WordBreakdownItem> breakdown,
        List<LanguageStat> detectedLanguages,
        int recognizedCount,
        int totalWords
) {}
