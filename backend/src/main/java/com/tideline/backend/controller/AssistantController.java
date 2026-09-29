package com.tideline.backend.controller;

import java.util.List;
import java.util.Map;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import com.tideline.backend.model.AssistantRequest;
import com.tideline.backend.model.AssistantResponse;
import com.tideline.backend.model.AssistantStatusResponse;
import com.tideline.backend.service.AssistantService;

/**
 * REST controller for TIDELINE Local AI Assistant.
 * Provides runtime status check and verified-grounded AI query endpoint.
 */
@RestController
@RequestMapping("/api/assistant")
@CrossOrigin
public class AssistantController {

    private final AssistantService assistantService;

    public AssistantController(AssistantService assistantService) {
        this.assistantService = assistantService;
    }

    /**
     * Base information endpoint describing TIDELINE Assistant status and capabilities.
     * GET /api/assistant
     */
    @GetMapping
    public ResponseEntity<Map<String, Object>> getInfo() {
        AssistantStatusResponse status = assistantService.getStatus();
        return ResponseEntity.ok(Map.of(
                "name", "TIDELINE Local Marine AI Assistant",
                "version", "2.0.0",
                "mode", "OFFLINE_FIRST",
                "status", status.getStatus(),
                "runtime", status.getRuntime(),
                "defaultModel", status.getModel(),
                "availableModels", status.getAvailableModels(),
                "endpoint", status.getEndpoint(),
                "safetyDirectives", List.of(
                        "100% Offline & Local Operation",
                        "Strict Grounding in Verified Vessel Data",
                        "Zero Fabrication of GPS / Telemetry / Weather",
                        "Clear Distinction Between Stored Data & General AI"
                )
        ));
    }

    /**
     * Lists available models in local Ollama inference runtime.
     * GET /api/assistant/models
     */
    @GetMapping("/models")
    public ResponseEntity<List<String>> getModels() {
        return ResponseEntity.ok(assistantService.getAvailableModels());
    }

    /**
     * Checks if local LLM inference engine (Ollama) is available.
     * GET /api/assistant/status
     */
    @GetMapping("/status")
    public ResponseEntity<AssistantStatusResponse> getStatus() {
        return ResponseEntity.ok(assistantService.getStatus());
    }

    /**
     * Processes mariner query with strict grounding in verified TIDELINE data.
     * POST /api/assistant/chat
     */
    @PostMapping("/chat")
    public ResponseEntity<AssistantResponse> chat(@RequestBody AssistantRequest request) {
        return ResponseEntity.ok(assistantService.processQuery(request));
    }

    /**
     * Alias for POST /api/assistant/chat
     * POST /api/assistant/query
     */
    @PostMapping("/query")
    public ResponseEntity<AssistantResponse> query(@RequestBody AssistantRequest request) {
        return ResponseEntity.ok(assistantService.processQuery(request));
    }

    /**
     * Base alias for POST /api/assistant
     */
    @PostMapping
    public ResponseEntity<AssistantResponse> rootChat(@RequestBody AssistantRequest request) {
        return ResponseEntity.ok(assistantService.processQuery(request));
    }
}
