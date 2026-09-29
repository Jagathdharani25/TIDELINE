package com.tideline.backend.model;

import java.util.List;

/**
 * AssistantStatusResponse DTO for checking local LLM runtime health.
 */
public class AssistantStatusResponse {

    private String status;           // "ONLINE", "UNAVAILABLE"
    private String runtime;          // "Ollama"
    private String endpoint;         // e.g. "http://localhost:11434"
    private String model;            // configured default model
    private List<String> availableModels;
    private String message;

    public AssistantStatusResponse() {
    }

    public AssistantStatusResponse(String status, String runtime, String endpoint,
                                   String model, List<String> availableModels, String message) {
        this.status = status;
        this.runtime = runtime;
        this.endpoint = endpoint;
        this.model = model;
        this.availableModels = availableModels;
        this.message = message;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public String getRuntime() {
        return runtime;
    }

    public void setRuntime(String runtime) {
        this.runtime = runtime;
    }

    public String getEndpoint() {
        return endpoint;
    }

    public void setEndpoint(String endpoint) {
        this.endpoint = endpoint;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public List<String> getAvailableModels() {
        return availableModels;
    }

    public void setAvailableModels(List<String> availableModels) {
        this.availableModels = availableModels;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
