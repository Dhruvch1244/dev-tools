package com.dhruv.devtools.jenkins;

import jakarta.persistence.*;

import java.time.Instant;

/**
 * One captured Helm tag: "service X was deployed to environment Y with tag Z, by this build".
 * The Rehydration board is the latest record per (service, environment), plus history.
 */
@Entity
@Table(name = "helm_tag_record", indexes = @Index(columnList = "service,environment"))
public class HelmTagRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 200)
    private String service;

    @Column(nullable = false, length = 120)
    private String environment;

    @Column(nullable = false, length = 300)
    private String helmTag;

    @Column(length = 300) private String chart;
    @Column(length = 300) private String chartVersion;
    @Column(length = 300) private String imageTag;
    @Column(length = 200) private String namespace;
    @Column(length = 200) private String serverName;
    @Column(length = 1000) private String jobPath;
    private Integer buildNumber;
    @Column(length = 1500) private String buildUrl;
    @Lob private String notes;

    @Column(nullable = false)
    private Instant capturedAt;

    @PrePersist
    void onCreate() {
        if (capturedAt == null) capturedAt = Instant.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getService() { return service; }
    public void setService(String service) { this.service = service; }
    public String getEnvironment() { return environment; }
    public void setEnvironment(String environment) { this.environment = environment; }
    public String getHelmTag() { return helmTag; }
    public void setHelmTag(String helmTag) { this.helmTag = helmTag; }
    public String getChart() { return chart; }
    public void setChart(String chart) { this.chart = chart; }
    public String getChartVersion() { return chartVersion; }
    public void setChartVersion(String chartVersion) { this.chartVersion = chartVersion; }
    public String getImageTag() { return imageTag; }
    public void setImageTag(String imageTag) { this.imageTag = imageTag; }
    public String getNamespace() { return namespace; }
    public void setNamespace(String namespace) { this.namespace = namespace; }
    public String getServerName() { return serverName; }
    public void setServerName(String serverName) { this.serverName = serverName; }
    public String getJobPath() { return jobPath; }
    public void setJobPath(String jobPath) { this.jobPath = jobPath; }
    public Integer getBuildNumber() { return buildNumber; }
    public void setBuildNumber(Integer buildNumber) { this.buildNumber = buildNumber; }
    public String getBuildUrl() { return buildUrl; }
    public void setBuildUrl(String buildUrl) { this.buildUrl = buildUrl; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public Instant getCapturedAt() { return capturedAt; }
    public void setCapturedAt(Instant capturedAt) { this.capturedAt = capturedAt; }
}
