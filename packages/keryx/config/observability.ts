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
  /** Maximum spans queued before dropping. */
  spanQueueSize: await loadFromEnvIfSet("OTEL_SPAN_QUEUE_SIZE", 2048),
  /** Max spans exported per batch. */
  spanBatchSize: await loadFromEnvIfSet("OTEL_SPAN_BATCH_SIZE", 512),
  /** Delay in ms between scheduled span exports. */
  spanExportDelayMs: await loadFromEnvIfSet("OTEL_SPAN_EXPORT_DELAY_MS", 5000),
  /** Timeout in ms for flushing pending spans on shutdown. */
  spanShutdownTimeoutMs: await loadFromEnvIfSet(
    "OTEL_SPAN_SHUTDOWN_TIMEOUT_MS",
    5000,
  ),
};
