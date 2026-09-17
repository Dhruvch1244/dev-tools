package com.dhruv.devtools.language;

import com.dhruv.devtools.dto.HinglishConvertResult;
import com.dhruv.devtools.dto.TextRequest;
import com.dhruv.devtools.service.HistoryService;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/hinglish-convert")
public class HinglishController {

    private final HinglishConverterService hinglishConverterService;
    private final HistoryService historyService;

    public HinglishController(HinglishConverterService hinglishConverterService, HistoryService historyService) {
        this.hinglishConverterService = hinglishConverterService;
        this.historyService = historyService;
    }

    @PostMapping
    public HinglishConvertResult convert(@RequestBody TextRequest request) {
        HinglishConvertResult result = hinglishConverterService.convert(request.text());
        historyService.record("hinglish-convert", request.text(), request.text(), result.plainEnglish());
        return result;
    }
}
