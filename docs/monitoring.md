# Observability — Prometheus, Grafana, Loki

This document describes the local observability stack that ships with `mimir-server`, how it is wired into the NestJS application, and how to operate it day-to-day.

> Audience: backend engineers and on-call.
> Scope: local development + CI. Production deployment notes are at the end.

---

## 1. What the stack gives you

| Concern | Tool | Endpoint |
|---|---|---|
| Metrics scraping & storage | **Prometheus 2.55** | http://localhost:9091 |
| Log aggregation | **Loki 3.2** | http://localhost:3100 |
| Log collection from Docker | **Promtail 3.2** | (no UI; ships logs to Loki) |
| Container resource metrics | **cAdvisor 0.49** | http://localhost:8081 |
| Dashboards & exploration | **Grafana 11.3** | http://localhost:3000 |
| Application metrics | **`@willsoto/nestjs-prometheus`** in NestJS | http://localhost:9090/metrics |

All five containers run on a dedicated `mimir-monitoring` Docker network defined in [`docker-compose.monitoring.yml`](../docker-compose.monitoring.yml). They are intentionally separate from the app-infrastructure stack (`docker-compose.yml`) so monitoring can be brought up or down without restarting Postgres / Redis / Elasticsearch / MinIO / ClickHouse.

---

## 2. Architecture

```
┌──────────────────────────┐
│ mimir-api (NestJS)       │  PORT 9090
│  ─ Express + Winston     │
│  ─ Histogram interceptor │
└──────────────┬───────────┘
               │ pulls /metrics
               │ tails stdout JSON via Docker socket
       ┌───────┼────────────────────────────────┐
       ▼       ▼                                ▼
 Prometheus  Promtail                       cAdvisor
   (9091)     │                              (8081)
       │      │                                │
       │      ▼                                │
       │    Loki                               │
       │    (3100)                             │
       │      │                                │
       └──────┴──────────────┬─────────────────┘
                             ▼
                         Grafana
                          (3000)
```

- **Prometheus** scrapes `/metrics` from the NestJS app every 15 s. It also scrapes cAdvisor and itself.
- **Promtail** uses Docker service discovery to find every container whose `com.docker.compose.project` label is set, tails its stdout/stderr, runs a JSON parsing pipeline, and pushes labeled streams to Loki.
- **Loki** stores logs on its own filesystem volume using TSDB indices + filesystem-chunk storage (single-tenant, no auth — local only).
- **Grafana** is provisioned at boot with both data sources and a default dashboard.

---

## 3. NestJS instrumentation

### 3.1 Metrics module

[`src/common/metrics/metrics.module.ts`](../src/common/metrics/metrics.module.ts) registers:

- `PrometheusModule.register({ path: '/metrics', defaultMetrics: { enabled: true } })` — exposes Node.js process metrics (`process_*`, `nodejs_*`)
- Three custom collectors:

| Metric | Type | Labels | Purpose |
|---|---|---|---|
| `mimir_http_request_duration_seconds` | Histogram | `method`, `route`, `status_code` | p50 / p95 / p99 latency, request rate, error rate |
| `mimir_http_requests_in_flight` | Gauge | `method` | Saturation / concurrency |
| `mimir_app_start_total` | Counter | `service` | Restart / crash detection |

Buckets for the latency histogram: `5 ms, 10 ms, 25 ms, 50 ms, 100 ms, 250 ms, 500 ms, 1 s, 2.5 s, 5 s, 10 s`. These match the roadmap's p95 < 300 ms SLO so the bucket boundaries are useful for alert thresholds.

The interceptor [`HttpMetricsInterceptor`](../src/common/metrics/http-metrics.interceptor.ts) is registered globally via `APP_INTERCEPTOR`. It uses `req.route.path` rather than `req.url` so `/users/123` and `/users/456` collapse to the route template `/users/:id` — this keeps Prometheus cardinality bounded.

### 3.2 Default labels

Every metric is decorated with two labels set at boot:

```yaml
app: mimir-api
service: ${SERVICE_NAME:-monolith}
```

When the codebase eventually splits into separate services (auth-svc, study-svc, etc.), each will set its own `SERVICE_NAME` and the same dashboards work without modification.

### 3.3 Structured logging

[`src/common/logger/logger.service.ts`](../src/common/logger/logger.service.ts) emits two formats:

- **Development (`NODE_ENV != production`)**: colorized single-line text with timestamp + level + context + message
- **Production**: one JSON object per line:

```json
{
  "timestamp": "2026-06-23T14:09:15.961Z",
  "level": "info",
  "service": "mimir-api",
  "context": "AuthController",
  "message": "user logged in",
  "stack": null,
  "userId": "abc-123"
}
```

Promtail's pipeline ([`monitoring/promtail/promtail-config.yml`](../monitoring/promtail/promtail-config.yml)) parses the JSON, promotes `level` and `service` to indexed labels, and uses the app's own `timestamp` so log time matches request time even if there's queue lag.

---

## 4. Bringing the stack up

### Prerequisites
- Docker 24+ with Compose v2
- Free ports: 3000 (Grafana), 9091 (Prometheus), 3100 (Loki), 8081 (cAdvisor)
- The app must be running on the host (the stack expects to scrape `host.docker.internal:9090`)

### Boot

```bash
# from the repo root
docker compose -f docker-compose.monitoring.yml up -d

# verify health
docker compose -f docker-compose.monitoring.yml ps
```

Each container has a healthcheck — wait until `STATUS` says `(healthy)` before opening Grafana.

### Stop

```bash
docker compose -f docker-compose.monitoring.yml down       # keeps volumes
docker compose -f docker-compose.monitoring.yml down -v    # wipes data
```

### Tail logs

```bash
docker compose -f docker-compose.monitoring.yml logs -f grafana
docker compose -f docker-compose.monitoring.yml logs -f loki
```

---

## 5. Accessing the UIs

### Grafana — http://localhost:3000
- Default credentials: `admin / admin` (override with `GRAFANA_ADMIN_PASSWORD` env var)
- The provisioned dashboard is at **Dashboards → Mimir → Mimir API Overview**

### Prometheus — http://localhost:9091
- Use Status → Targets to confirm the `mimir-api` job is `UP`
- Useful PromQL examples:

```promql
# Request rate per route (last 5 m)
sum by (route) (rate(mimir_http_request_duration_seconds_count[5m]))

# p95 latency per route
histogram_quantile(
  0.95,
  sum by (le, route) (rate(mimir_http_request_duration_seconds_bucket[5m]))
)

# 5xx error rate
sum by (route) (rate(mimir_http_request_duration_seconds_count{status_code=~"5.."}[5m]))

# Memory growth
deriv(process_resident_memory_bytes{job="mimir-api"}[10m])
```

### Loki (via Grafana Explore)
LogQL examples:

```logql
# All errors in the last hour
{compose_project=~".+"} | json | level="error"

# Auth-related logs from the API
{compose_project=~".+", container=~".*api.*"} | json | context="AuthController"

# Rate of warnings per minute
sum by (level) (rate({compose_project=~".+"} | json | level=~"warn|error" [1m]))
```

---

## 6. Default dashboard — *Mimir API Overview*

[`monitoring/grafana/dashboards/mimir-api-overview.json`](../monitoring/grafana/dashboards/mimir-api-overview.json) provides six panels:

| Panel | Metric | Why |
|---|---|---|
| Up | `up{job="mimir-api"}` | Liveness signal |
| HTTP Request Rate | `rate(mimir_http_request_duration_seconds_count[5m])` per route | Traffic volume |
| HTTP p95 Latency | `histogram_quantile(0.95, ...)` | SLO tracking (target: < 300 ms) |
| HTTP 5xx Rate | counts with `status_code=~"5.."` | Error budget |
| Process Memory (RSS) | `process_resident_memory_bytes` | Leak detection |
| Recent Errors (Loki) | `{compose_project=~".+"} \| json \| level=~"error\|warn"` | Triage |

Dashboards are file-provisioned; `allowUiUpdates: true` means edits in the UI persist to the in-memory copy but are lost on container restart. To save a change permanently, export the JSON from Grafana (Share → Export → Save to file) and replace the on-disk file.

---

## 7. Configuration reference

| Env var | Default | Where it's used |
|---|---|---|
| `PROMETHEUS_PORT` | `9091` | Host port for Prometheus UI |
| `LOKI_PORT` | `3100` | Host port for Loki HTTP |
| `GRAFANA_PORT` | `3000` | Host port for Grafana |
| `CADVISOR_PORT` | `8081` | Host port for cAdvisor |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana admin login |
| `GRAFANA_ADMIN_PASSWORD` | `admin` | Grafana admin password |
| `SERVICE_NAME` | `monolith` (app side) | Label applied to all metrics + logs |
| `NODE_ENV` | `development` (app side) | Switches logger between pretty + JSON |

All five containers persist data to named Docker volumes:

| Volume | Purpose |
|---|---|
| `prometheus-data` | Time-series database (15 day retention) |
| `loki-data` | Chunks + TSDB indices |
| `promtail-data` | Position file for resumable tailing |
| `grafana-data` | Saved dashboards, users, prefs |

---

## 8. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Prometheus shows `mimir-api` target `DOWN` | App not running, or wrong port | `curl localhost:9090/metrics`; check `host.docker.internal` resolves inside Prometheus container |
| `host.docker.internal` resolves to nothing on Linux | Old Docker version | The compose file already declares `extra_hosts: ["host.docker.internal:host-gateway"]` — works on Docker 20.10+ |
| Loki "no logs" in Grafana Explore | Promtail not seeing containers | Check `docker compose -f docker-compose.monitoring.yml logs promtail` for socket-permission errors |
| Logs show but `level` label is missing | App emitting non-JSON logs | Verify `NODE_ENV=production` is set when expecting JSON, or remove the `level` label requirement |
| Grafana shows "Datasource Prometheus not found" | Provisioning file path wrong | Inspect `/etc/grafana/provisioning/datasources/datasources.yml` inside the container |
| Cardinality explosion on `route` label | A controller's path-param wasn't captured by `req.route.path` | The interceptor falls back to `req.originalUrl` — refactor the controller to use the canonical NestJS param syntax (`:id`) |
| Disk filling up | 15 day retention exceeded | Tune `--storage.tsdb.retention.time` in `docker-compose.monitoring.yml` |

---

## 9. Production deployment notes

This stack is **single-node, no-auth, no-TLS** — fine for local dev but unsuitable for production as-is. Before shipping:

1. **Authentication**
   - Put Grafana behind SSO (OAuth/OIDC) or set `GF_AUTH_ANONYMOUS_ENABLED=false` (already set) + a strong admin password
   - Add basic-auth or mTLS on `/metrics` — anyone scraping it can enumerate routes
2. **Storage**
   - Loki filesystem storage doesn't scale. Use S3-compatible object storage (`s3`, `gcs`, or MinIO) with the proper schema config
   - Prometheus → consider remote-write to Thanos / Cortex / Mimir (the project) for long retention and HA
3. **Promtail → Alloy**
   - Grafana has deprecated Promtail in favour of Grafana Alloy. Plan a migration when the team is comfortable.
   - In Kubernetes, switch from `docker_sd_configs` to `kubernetes_sd_configs` and run as a DaemonSet
4. **Resource limits**
   - Add `mem_limit` / `cpus` to each container in production compose
   - `bootstrap.memory_lock=true` for Elasticsearch is already set; mirror that for production
5. **Alerting**
   - Add Alertmanager (separate container) and define alert rules in `monitoring/prometheus/rules/`
   - At minimum: `up == 0` for 2 m, p95 > 600 ms for 10 m, 5xx rate > 1% for 5 m
6. **Dashboard versioning**
   - Treat dashboards as code — keep `mimir-api-overview.json` in git, never edit through the UI without exporting back to disk
7. **cAdvisor**
   - Heavy on the host; skip in production if you already have Kubernetes node-exporter / kube-state-metrics

---

## 10. Adding a new metric

```ts
// in some module
import { Module } from '@nestjs/common';
import { makeCounterProvider } from '@willsoto/nestjs-prometheus';

@Module({
  providers: [
    makeCounterProvider({
      name: 'mimir_studyset_created_total',
      help: 'Total study sets created',
      labelNames: ['visibility'],
    }),
  ],
})
export class StudySetModule {}

// in the service
import { InjectMetric } from '@willsoto/nestjs-prometheus';
import { Counter } from 'prom-client';

@Injectable()
export class StudySetService {
  constructor(
    @InjectMetric('mimir_studyset_created_total')
    private readonly created: Counter<string>,
  ) {}

  async create(dto: CreateStudySetDto) {
    const set = await this.repo.create(dto);
    this.created.inc({ visibility: set.visibility });
    return set;
  }
}
```

Naming convention: `mimir_<domain>_<action>_<unit>` (e.g. `mimir_ai_generation_duration_seconds`). Use snake_case, prefix with `mimir_` to avoid clashing with Node defaults, and end with the unit (`_total`, `_seconds`, `_bytes`).

---

## 11. References

- [Prometheus exposition format](https://prometheus.io/docs/instrumenting/exposition_formats/)
- [PromQL functions](https://prometheus.io/docs/prometheus/latest/querying/functions/)
- [LogQL reference](https://grafana.com/docs/loki/latest/logql/)
- [`@willsoto/nestjs-prometheus` README](https://github.com/willsoto/nestjs-prometheus)
- [Grafana provisioning](https://grafana.com/docs/grafana/latest/administration/provisioning/)
