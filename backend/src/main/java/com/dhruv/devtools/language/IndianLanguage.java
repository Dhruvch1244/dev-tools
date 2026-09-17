package com.dhruv.devtools.language;

public enum IndianLanguage {
    TAMIL("Tamil", true),
    TELUGU("Telugu", true),
    KANNADA("Kannada", true),
    MALAYALAM("Malayalam", true),
    HINDI("Hindi", false),
    PUNJABI("Punjabi", false),
    MARATHI("Marathi", false),
    GUJARATI("Gujarati", false),
    BENGALI("Bengali", false);

    private final String displayName;
    private final boolean south;

    IndianLanguage(String displayName, boolean south) {
        this.displayName = displayName;
        this.south = south;
    }

    public String displayName() {
        return displayName;
    }

    public boolean isSouth() {
        return south;
    }
}
