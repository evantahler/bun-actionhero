import { loadFromEnvIfSet } from "../util/config";

export const configObservability = {
  enabled: await loadFromEnvIfSet("OTEL_METRICS_ENABLED", false),
  metricsRoute: await loadFromEnvIfSet("OTEL_METRICS_ROUTE", "/metrics"),
  serviceName: await loadFromEnvIfSet("OTEL_SERVICE_NAME", ""),
  tracingEnabled: await loadFromEnvIfSet("OTEL_TRACING_ENABLED", false),
  otlpEndpoint: await loadFromEnvIfSet(
    "OTEL_EXPORTER_OTLP_ENDPOINT",
    "http://localhost:4318",
  ),
  tracingSampleRate: await loadFromEnvIfSet("OTEL_TRACING_SAMPLE_RATE", 1.0),
};
