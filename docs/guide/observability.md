---
description: OpenTelemetry-based metrics for HTTP requests, WebSocket connections, action executions, and background tasks — with a built-in Prometheus scrape endpoint.
---

# Observability

Keryx includes built-in OpenTelemetry instrumentation that provides metrics for HTTP requests, WebSocket connections, action executions, and background tasks. Disabled by default — enable it and scrape `/metrics` for Prometheus.

## Quick Start

1. Enable metrics via environment variable:

```bash
OTEL_METRICS_ENABLED=true bun run start
```

2. Scrape metrics at `GET /metrics` (Prometheus exposition format).

## Configuration

| Config Key     | Env Var                | Default      | Description                                                                                |
| -------------- | ---------------------- | ------------ | ------------------------------------------------------------------------------------------ |
| `enabled`      | `OTEL_METRICS_ENABLED` | `false`      | Master toggle for all instrumentation                                                      |
| `metricsRoute` | `OTEL_METRICS_ROUTE`   | `"/metrics"` | Path for the Prometheus scrape endpoint                                                    |
| `serviceName`  | `OTEL_SERVICE_NAME`    | _(app name)_ | Service name in metric labels. Defaults to the `name` field from your app's `package.json` |

## Available Metrics

### HTTP

| Metric                          | Type           | Attributes            | Description                       |
| ------------------------------- | -------------- | --------------------- | --------------------------------- |
| `keryx.http.requests`           | Counter        | method, route, status | Total HTTP requests received      |
| `keryx.http.request.duration`   | Histogram (ms) | method, route, status | HTTP request duration             |
| `keryx.http.active_connections` | UpDownCounter  | —                     | Currently active HTTP connections |

### WebSocket

| Metric                 | Type          | Attributes | Description                            |
| ---------------------- | ------------- | ---------- | -------------------------------------- |
| `keryx.ws.connections` | UpDownCounter | —          | Currently active WebSocket connections |
| `keryx.ws.messages`    | Counter       | —          | Total WebSocket messages received      |

### Actions

| Metric                    | Type           | Attributes     | Description               |
| ------------------------- | -------------- | -------------- | ------------------------- |
| `keryx.action.executions` | Counter        | action, status | Total action executions   |
| `keryx.action.duration`   | Histogram (ms) | action         | Action execution duration |

Action metrics are recorded for all transports (HTTP, WebSocket, tasks, internal).

### Background Tasks

| Metric                | Type           | Attributes            | Description                     |
| --------------------- | -------------- | --------------------- | ------------------------------- |
| `keryx.task.enqueued` | Counter        | action, queue         | Total tasks enqueued            |
| `keryx.task.executed` | Counter        | action, queue, status | Total tasks executed by workers |
| `keryx.task.duration` | Histogram (ms) | action                | Task execution duration         |

### System

| Metric                     | Type             | Description                    |
| -------------------------- | ---------------- | ------------------------------ |
| `keryx.system.connections` | Observable Gauge | Current total connection count |

## Prometheus Integration

The `/metrics` endpoint serves metrics in [Prometheus exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/). Because each Keryx process serves its own `/metrics` endpoint, **every node in your cluster must be scraped individually** — metrics are not aggregated across instances. Use Prometheus service discovery or list each target explicitly.

Add a scrape target to your `prometheus.yml`:

```yaml
scrape_configs:
  - job_name: "keryx"
    scrape_interval: 15s
    metrics_path: "/metrics"
    static_configs:
      - targets: ["localhost:8080"]
```

The metrics endpoint is served on the existing web server — no additional ports or servers needed. It's intercepted before action routing, so it won't conflict with your API routes. Keryx validates at startup that no action route overlaps with the metrics path.

## Custom Exporters

The built-in `/metrics` endpoint covers the Prometheus pull model. For push-based exporters (OTLP, Datadog, etc.), configure your own `MeterProvider` before calling `api.start()`:

```ts
import { metrics } from "@opentelemetry/api";
import { MeterProvider } from "@opentelemetry/sdk-metrics";
import { OTLPMetricExporter } from "@opentelemetry/exporter-metrics-otlp-http";
import { PeriodicExportingMetricReader } from "@opentelemetry/sdk-metrics";

const exporter = new OTLPMetricExporter({
  url: "https://your-collector:4318/v1/metrics",
});

const provider = new MeterProvider({
  readers: [
    new PeriodicExportingMetricReader({
      exporter,
      exportIntervalMillis: 30_000,
    }),
  ],
});

metrics.setGlobalMeterProvider(provider);
```

Keryx's instruments use the global OTel API, so they'll automatically report to whatever `MeterProvider` is registered.

## Programmatic Access

You can collect metrics programmatically via `api.observability.collectMetrics()`:

```ts
import { api } from "keryx";

const prometheusText = await api.observability.collectMetrics();
```

The instruments are also available directly for custom recording:

```ts
api.observability.http.requestsTotal.add(1, {
  method: "GET",
  route: "/custom",
  status: "200",
});
api.observability.action.duration.record(42, { action: "myAction" });
```

