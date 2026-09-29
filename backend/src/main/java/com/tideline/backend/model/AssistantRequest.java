package com.tideline.backend.model;

import java.util.Map;

/**
 * AssistantRequest DTO for local AI queries.
 */
public class AssistantRequest {

    private String query;
    private Map<String, Object> context;
    private String model;

    public AssistantRequest() {
    }

    public AssistantRequest(String query, Map<String, Object> context, String model) {
        this.query = query;
        this.context = context;
        this.model = model;
    }

    public String getQuery() {
        return query;
    }

    public void setQuery(String query) {
        this.query = query;
    }

    public Map<String, Object> getContext() {
        return context;
    }

    public void setContext(Map<String, Object> context) {
        this.context = context;
    }

    public String getModel() {
        return model;
    }

    public void setModel(String model) {
        this.model = model;
    }
}
