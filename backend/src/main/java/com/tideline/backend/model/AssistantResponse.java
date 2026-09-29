package com.tideline.backend.model;

/**
 * AssistantResponse DTO returned by /api/assistant.
 */
public class AssistantResponse {

    private boolean success;
    private String answer;
    private String source;           // "LOCAL_LLM", "VERIFIED_TIDELINE_DATA", "GENERAL_KNOWLEDGE", "DETERMINISTIC_ENGINE"
    private String model;            // "llama3.2:1b"
    private String status;           // "ONLINE", "MODEL_UNAVAILABLE", "ERROR"
    private boolean grounded;        // true if grounded in verified vessel context
    private String verifiedSource;   // e.g. "VERIFIED_GPS", "VERIFIED_VOYAGE_DB", "OFFLINE_GUIDES", "CACHED_CHARTS"
    private String message;

    public AssistantResponse() {
    }

    public AssistantResponse(boolean success, String answer, String source, String model,
                             String status, boolean grounded, String verifiedSource, String message) {
        this.success = success;
        this.answer = answer;
        this.source = source;
        this.model = model;
        this.status = status;
        this.grounded = grounded;
        this.verifiedSource = verifiedSource;
        this.message = message;
    }

    public boolean isSuccess() {
        return success;
    }

    public void setSuccess(boolean success) {
        this.success = success;
    }

    public String getAnswer() {
        return answer;
    }

    public void setAnswer(String answer) {
        this.answer = answer;
    }

    public String getSource() {
        return source;
    }

    public void setSource(String source) {
        this.source = source;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }

    public String getStatus() {
        return status;
    }

    public void setStatus(String status) {
        this.status = status;
    }

    public boolean isGrounded() {
        return grounded;
    }

    public void setGrounded(boolean grounded) {
        this.grounded = grounded;
    }

    public String getVerifiedSource() {
        return verifiedSource;
    }

    public void setVerifiedSource(String verifiedSource) {
        this.verifiedSource = verifiedSource;
    }

    public String getMessage() {
        return message;
    }

    public void setMessage(String message) {
        this.message = message;
    }
}
