package com.dhruv.devtools.language;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static com.dhruv.devtools.language.IndianLanguage.*;

/**
 * A curated, offline word/phrase dictionary for romanized Indian languages.
 * South Indian languages (Tamil, Telugu, Kannada, Malayalam) carry deliberately denser
 * coverage than the North Indian ones — they're usually the ones left out of "Hinglish"
 * tools that only handle Hindi-in-English-letters.
 * <p>
 * Entries are listed South-first so that a romanized spelling shared across languages
 * (e.g. "amma" for mother) resolves to a South Indian attribution by default.
 */
final class HinglishDictionary {

    private HinglishDictionary() {}

    private static final List<PhraseEntry> ENTRIES = List.of(
            // ---------------- Tamil ----------------
            e("vanakkam", "hello / greetings", "नमस्ते", TAMIL),
            e("eppadi irukka", "how are you", "तुम कैसे हो", TAMIL),
            e("nalla irukken", "I am fine", "मैं ठीक हूँ", TAMIL),
            e("enna panra", "what are you doing", "तुम क्या कर रहे हो", TAMIL),
            e("enna panreenga", "what are you doing", "आप क्या कर रहे हैं", TAMIL),
            e("saapadu", "food", "खाना", TAMIL),
            e("saapten", "I ate", "मैंने खा लिया", TAMIL),
            e("saaptiya", "did you eat", "क्या तुमने खाया", TAMIL),
            e("thanni", "water", "पानी", TAMIL),
            e("veedu", "house", "घर", TAMIL),
            e("amma", "mother", "माँ", TAMIL),
            e("appa", "father", "पिता", TAMIL),
            e("anna", "elder brother", "बड़ा भाई", TAMIL),
            e("akka", "elder sister", "बड़ी बहन", TAMIL),
            e("thambi", "younger brother", "छोटा भाई", TAMIL),
            e("thangachi", "younger sister", "छोटी बहन", TAMIL),
            e("machan", "buddy / dude", "यार", TAMIL),
            e("po", "go", "जाओ", TAMIL),
            e("vaa", "come", "आओ", TAMIL),
            e("vanga", "come", "आइए", TAMIL),
            e("seri", "okay / fine", "ठीक है", TAMIL),
            e("illa", "no", "नहीं", TAMIL),
            e("aama", "yes", "हाँ", TAMIL),
            e("venam", "don't want", "नहीं चाहिए", TAMIL),
            e("venum", "want / need", "चाहिए", TAMIL),
            e("konjam", "a little", "थोड़ा", TAMIL),
            e("rombha", "very / a lot", "बहुत", TAMIL),
            e("semma", "awesome / excellent", "बहुत बढ़िया", TAMIL),
            e("mokka", "lame / boring", "बकवास", TAMIL),
            e("yaaru", "who", "कौन", TAMIL),
            e("enga", "where", "कहाँ", TAMIL),
            e("eppo", "when", "कब", TAMIL),
            e("yean", "why", "क्यों", TAMIL),
            e("epdi", "how", "कैसे", TAMIL),
            e("pesu", "talk / speak", "बोलो", TAMIL),
            e("padi", "study / read", "पढ़ो", TAMIL),
            e("velai", "work", "काम", TAMIL),
            e("nanba", "friend", "दोस्त", TAMIL),
            e("kadhal", "love", "प्रेम", TAMIL),
            e("azhaga", "beautiful", "सुंदर", TAMIL),

            // ---------------- Telugu ----------------
            e("namaskaram", "hello / greetings", "नमस्ते", TELUGU),
            e("ela unnaru", "how are you", "आप कैसे हैं", TELUGU),
            e("ela unnav", "how are you", "तुम कैसे हो", TELUGU),
            e("bagunnanu", "I am fine", "मैं ठीक हूँ", TELUGU),
            e("em chestunnav", "what are you doing", "तुम क्या कर रहे हो", TELUGU),
            e("em chestunnaru", "what are you doing", "आप क्या कर रहे हैं", TELUGU),
            e("annam", "food / rice", "खाना", TELUGU),
            e("thinnava", "did you eat", "क्या तुमने खाया", TELUGU),
            e("neellu", "water", "पानी", TELUGU),
            e("illu", "house", "घर", TELUGU),
            e("nanna", "father", "पिता", TELUGU),
            e("thammudu", "younger brother", "छोटा भाई", TELUGU),
            e("chelli", "younger sister", "छोटी बहन", TELUGU),
            e("randi", "come", "आइए", TELUGU),
            e("raa", "come", "आओ", TELUGU),
            e("vellu", "go", "जाओ", TELUGU),
            e("sare", "okay", "ठीक है", TELUGU),
            e("ledu", "no", "नहीं", TELUGU),
            e("avunu", "yes", "हाँ", TELUGU),
            e("vaddu", "don't want", "मत करो", TELUGU),
            e("kavali", "want / need", "चाहिए", TELUGU),
            e("konchem", "a little", "थोड़ा", TELUGU),
            e("chala", "very / a lot", "बहुत", TELUGU),
            e("bagundi", "it's good / nice", "बहुत अच्छा है", TELUGU),
            e("evaru", "who", "कौन", TELUGU),
            e("ekkada", "where", "कहाँ", TELUGU),
            e("eppudu", "when", "कब", TELUGU),
            e("enduku", "why", "क्यों", TELUGU),
            e("ela", "how", "कैसे", TELUGU),
            e("matladu", "talk / speak", "बोलो", TELUGU),
            e("adugu", "ask", "पूछो", TELUGU),
            e("chaduvu", "study / read", "पढ़ो", TELUGU),
            e("pani", "work", "काम", TELUGU),
            e("dabbulu", "money", "पैसे", TELUGU),
            e("prema", "love", "प्रेम", TELUGU),
            e("andanga", "beautiful", "सुंदर", TELUGU),
            e("babu", "dear / friend", "प्रिय", TELUGU),

            // ---------------- Kannada ----------------
            e("namaskara", "hello / greetings", "नमस्ते", KANNADA),
            e("hegiddira", "how are you", "आप कैसे हैं", KANNADA),
            e("hegiddiya", "how are you", "तुम कैसे हो", KANNADA),
            e("chennagiddini", "I am fine", "मैं ठीक हूँ", KANNADA),
            e("enu maadthidiya", "what are you doing", "तुम क्या कर रहे हो", KANNADA),
            e("oota", "food", "खाना", KANNADA),
            e("oota aaytha", "did you eat", "क्या तुमने खाना खाया", KANNADA),
            e("neeru", "water", "पानी", KANNADA),
            e("mane", "house", "घर", KANNADA),
            e("tamma", "younger brother", "छोटा भाई", KANNADA),
            e("tangi", "younger sister", "छोटी बहन", KANNADA),
            e("guru", "friend / boss", "दोस्त / उस्ताद", KANNADA),
            e("baa", "come", "आओ", KANNADA),
            e("banni", "come", "आइए", KANNADA),
            e("hogu", "go", "जाओ", KANNADA),
            e("houdu", "yes", "हाँ", KANNADA),
            e("beda", "don't want", "नहीं चाहिए", KANNADA),
            e("beku", "want / need", "चाहिए", KANNADA),
            e("swalpa", "a little", "थोड़ा", KANNADA),
            e("tumba", "very / a lot", "बहुत", KANNADA),
            e("chennagide", "it's good / nice", "बहुत अच्छा है", KANNADA),
            e("elli", "where", "कहाँ", KANNADA),
            e("yavaga", "when", "कब", KANNADA),
            e("yaake", "why", "क्यों", KANNADA),
            e("hege", "how", "कैसे", KANNADA),
            e("mathadu", "talk / speak", "बोलो", KANNADA),
            e("keli", "ask", "पूछो", KANNADA),
            e("odu", "study / read", "पढ़ो", KANNADA),
            e("kelsa", "work", "काम", KANNADA),
            e("hana", "money", "पैसे", KANNADA),
            e("preethi", "love", "प्रेम", KANNADA),
            e("sundara", "beautiful", "सुंदर", KANNADA),
            e("swalpa adjust maadi", "please adjust a little", "थोड़ा समायोजित करें", KANNADA),

            // ---------------- Malayalam ----------------
            e("sukhamano", "how are you", "तुम कैसे हो", MALAYALAM),
            e("sukhamaanu", "I am fine", "मैं ठीक हूँ", MALAYALAM),
            e("entha cheyyunnathu", "what are you doing", "तुम क्या कर रहे हो", MALAYALAM),
            e("choru", "food / rice", "खाना", MALAYALAM),
            e("kazhicho", "did you eat", "क्या तुमने खाया", MALAYALAM),
            e("vellam", "water", "पानी", MALAYALAM),
            e("achan", "father", "पिता", MALAYALAM),
            e("chettan", "elder brother", "बड़ा भाई", MALAYALAM),
            e("chechi", "elder sister", "बड़ी बहन", MALAYALAM),
            e("aniyan", "younger brother", "छोटा भाई", MALAYALAM),
            e("aniyathi", "younger sister", "छोटी बहन", MALAYALAM),
            e("machane", "dude / buddy", "यार", MALAYALAM),
            e("varu", "come", "आइए", MALAYALAM),
            e("sheri", "okay", "ठीक है", MALAYALAM),
            e("athe", "yes", "हाँ", MALAYALAM),
            e("venda", "don't want", "नहीं चाहिए", MALAYALAM),
            e("kurachu", "a little", "थोड़ा", MALAYALAM),
            e("valare", "very / a lot", "बहुत", MALAYALAM),
            e("kollam", "great / nice", "बहुत बढ़िया", MALAYALAM),
            e("evide", "where", "कहाँ", MALAYALAM),
            e("eppol", "when", "कब", MALAYALAM),
            e("enthina", "why", "क्यों", MALAYALAM),
            e("engane", "how", "कैसे", MALAYALAM),
            e("samsarikkuka", "talk / speak", "बोलो", MALAYALAM),
            e("chodikkuka", "ask", "पूछो", MALAYALAM),
            e("padikkuka", "study / read", "पढ़ो", MALAYALAM),
            e("joli", "work", "काम", MALAYALAM),
            e("panam", "money", "पैसा", MALAYALAM),
            e("sneham", "love", "प्रेम", MALAYALAM),
            e("sundari", "beautiful", "सुंदर", MALAYALAM),

            // ---------------- Hindi ----------------
            e("namaste", "hello / greetings", "नमस्ते", HINDI),
            e("kaise ho", "how are you", "तुम कैसे हो", HINDI),
            e("kaisi ho", "how are you", "तुम कैसी हो", HINDI),
            e("theek hoon", "I am fine", "मैं ठीक हूँ", HINDI),
            e("kya kar rahe ho", "what are you doing", "तुम क्या कर रहे हो", HINDI),
            e("khana", "food", "खाना", HINDI),
            e("khaya", "ate", "खाया", HINDI),
            e("paani", "water", "पानी", HINDI),
            e("ghar", "house", "घर", HINDI),
            e("maa", "mother", "माँ", HINDI),
            e("papa", "father", "पिता", HINDI),
            e("bhai", "brother", "भाई", HINDI),
            e("didi", "elder sister", "दीदी", HINDI),
            e("yaar", "friend / buddy", "यार", HINDI),
            e("aao", "come", "आओ", HINDI),
            e("jao", "go", "जाओ", HINDI),
            e("theek hai", "okay", "ठीक है", HINDI),
            e("nahi", "no", "नहीं", HINDI),
            e("haan", "yes", "हाँ", HINDI),
            e("nahi chahiye", "don't want", "नहीं चाहिए", HINDI),
            e("chahiye", "want / need", "चाहिए", HINDI),
            e("thoda", "a little", "थोड़ा", HINDI),
            e("bahut", "very / a lot", "बहुत", HINDI),
            e("accha", "good / okay", "अच्छा", HINDI),
            e("kaun", "who", "कौन", HINDI),
            e("kahan", "where", "कहाँ", HINDI),
            e("kab", "when", "कब", HINDI),
            e("kyun", "why", "क्यों", HINDI),
            e("kya", "what", "क्या", HINDI),
            e("kaise", "how", "कैसे", HINDI),
            e("baat karo", "talk", "बात करो", HINDI),
            e("poocho", "ask", "पूछो", HINDI),
            e("padho", "study / read", "पढ़ो", HINDI),
            e("kaam", "work", "काम", HINDI),
            e("paisa", "money", "पैसा", HINDI),
            e("pyaar", "love", "प्यार", HINDI),
            e("sundar", "beautiful", "सुंदर", HINDI),

            // ---------------- Punjabi ----------------
            e("sat sri akal", "hello / greetings", "नमस्ते", PUNJABI),
            e("ki haal hai", "how are you / what's up", "क्या हाल है", PUNJABI),
            e("changa", "good / fine", "अच्छा", PUNJABI),
            e("puttar", "son / dear", "बेटा", PUNJABI),
            e("kudi", "girl", "लड़की", PUNJABI),
            e("munda", "boy", "लड़का", PUNJABI),
            e("vadhiya", "great / nice", "बढ़िया", PUNJABI),
            e("haaji", "yes", "हाँ", PUNJABI),
            e("kithe", "where", "कहाँ", PUNJABI),
            e("ki", "what", "क्या", PUNJABI),

            // ---------------- Marathi ----------------
            e("namaskar", "hello / greetings", "नमस्ते", MARATHI),
            e("kasa ahes", "how are you", "तुम कैसे हो", MARATHI),
            e("kashi ahes", "how are you", "तुम कैसी हो", MARATHI),
            e("mi bara aahe", "I am fine", "मैं ठीक हूँ", MARATHI),
            e("kay karto ahes", "what are you doing", "तुम क्या कर रहे हो", MARATHI),
            e("jevan", "food / meal", "खाना", MARATHI),
            e("aai", "mother", "माँ", MARATHI),
            e("baba", "father", "पिता", MARATHI),
            e("changla", "good", "अच्छा", MARATHI),
            e("khup", "very / a lot", "बहुत", MARATHI),
            e("kuthe", "where", "कहाँ", MARATHI),
            e("kadhi", "when", "कब", MARATHI),
            e("kaay", "what", "क्या", MARATHI),

            // ---------------- Gujarati ----------------
            e("kem cho", "how are you", "तुम कैसे हो", GUJARATI),
            e("majama", "fine / great", "मज़े में", GUJARATI),
            e("shu karo cho", "what are you doing", "तुम क्या कर रहे हो", GUJARATI),
            e("jamvanu", "food / meal", "खाना", GUJARATI),
            e("bapa", "father", "पिता", GUJARATI),
            e("saras", "nice / good", "बढ़िया", GUJARATI),
            e("ketlu", "how much", "कितना", GUJARATI),
            e("kyan", "where", "कहाँ", GUJARATI),
            e("su", "what", "क्या", GUJARATI),

            // ---------------- Bengali ----------------
            e("kemon acho", "how are you", "तुम कैसे हो", BENGALI),
            e("bhalo achi", "I am fine", "मैं ठीक हूँ", BENGALI),
            e("ki korcho", "what are you doing", "तुम क्या कर रहे हो", BENGALI),
            e("khabar", "food", "खाना", BENGALI),
            e("jol", "water", "पानी", BENGALI),
            e("bari", "house", "घर", BENGALI),
            e("bhalo", "good", "अच्छा", BENGALI),
            e("kothay", "where", "कहाँ", BENGALI),
            e("keno", "why", "क्यों", BENGALI)
    );

    static final Map<String, PhraseEntry> LOOKUP = buildLookup();
    static final int MAX_PHRASE_WORDS = ENTRIES.stream().mapToInt(PhraseEntry::wordCount).max().orElse(1);

    private static PhraseEntry e(String phrase, String english, String hindi, IndianLanguage language) {
        return new PhraseEntry(phrase, english, hindi, language);
    }

    private static Map<String, PhraseEntry> buildLookup() {
        Map<String, PhraseEntry> map = new LinkedHashMap<>();
        for (PhraseEntry entry : ENTRIES) {
            map.putIfAbsent(entry.phrase(), entry);
        }
        return map;
    }
}
