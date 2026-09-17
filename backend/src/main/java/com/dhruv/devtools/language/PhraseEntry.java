package com.dhruv.devtools.language;

public record PhraseEntry(String phrase, String english, String hindi, IndianLanguage language) {

    int wordCount() {
        return phrase.split("\\s+").length;
    }
}
