# Frontend integration contract

## Ownership and hosting

The Figma export is preserved under `ui/figma-export/`, with its supplied
screen references under `ui/reference/`. Its React/Vite styling and page layout
are retained. API types/client, polling state, and development simulation are
separate modules under `ui/figma-export/src/api/`, `src/hooks/`, and
`src/simulation.ts`. Production pages read the REST API and display unavailable
values as `N/A`; synthetic values are enabled only in Vite development mode
with `?mode=simulation`.

The Vite production build writes static assets to the PlatformIO `data/`
directory. The central firmware serves those files locally from LittleFS. To
build the UI, run `corepack pnpm install --frozen-lockfile` and
`corepack pnpm build:esp32` from `ui/figma-export/`; then build/upload firmware and the filesystem with
`pio run -e central_s3`, `pio run -e central_s3 -t upload`, and
`pio run -e central_s3 -t uploadfs`. The central board profile is provisional
until its exact ESP32-S3 model is confirmed.

## Base URL and polling

The browser uses the same origin that served the page; API paths are relative
and need no CORS configuration in the normal deployment. A local Vite session
can proxy `/api` by setting `VITE_API_PROXY_TARGET` to the controller origin.
Poll `GET /api/data`
and `GET /api/status` asynchronously at a configurable interval (initial
proposal: 1 second for browser polling; final setting should be tuned against
node publish intervals). Fetch alert history separately from
`GET /api/alerts`, on page initialization and after alert changes or at a
slower configurable cadence. Do not reload the document to refresh readings.
Use request timeouts and retain the last successful render while showing a
stale/disconnected state if requests fail. No secret or SMTP credential is
sent to the browser.

## Response contracts

All successful responses use JSON and include a `schema_version` string.
Numeric values use SI units indicated in field names or API docs; unavailable
measurements use JSON `null`, never fabricated zeroes.

### `GET /api/data`

Returns the latest accepted snapshot for each node. A node without a valid
sample has `data: null`.

```json
{
  "schema_version": "1.0",
  "server_uptime_ms": 7654321,
  "nodes": {
    "gas_node": {
      "sensor_status": "ok",
      "node_uptime_ms": 123456,
      "last_seen_age_ms": 420,
      "data": {"adc_raw": 1200, "voltage_v": 0.97, "warmup_complete": true, "risk_level": "normal", "alarm_active": false}
    },
    "imu_node": {
      "sensor_status": "ok",
      "node_uptime_ms": 123456,
      "last_seen_age_ms": 390,
      "data": {"ax_mps2": 0.01, "ay_mps2": 0.02, "az_mps2": 9.80, "gx_dps": 0.1, "gy_dps": -0.2, "gz_dps": 0.0, "roll_deg": 0.12, "pitch_deg": -0.08}
    },
    "encoder_node": {
      "sensor_status": "ok",
      "node_uptime_ms": 123456,
      "last_seen_age_ms": 410,
      "data": {"left_rpm": 0.0, "right_rpm": 0.0, "left_distance_m": 0.0, "right_distance_m": 0.0, "distance_m": 0.0, "linear_speed_mps": 0.0, "heading_change_rad": null}
    }
  }
}
```

These values illustrate the schema only; firmware must populate responses from
received measurements, not hardcoded readings.

### Sensor payload examples

Node POST request examples, required fields, validation expectations, and
success responses are specified in
[communication_protocol.md](communication_protocol.md). The normalized
dashboard field names above are the intended read contract. Gas values are
ADC-based, not ppm. IMU gyro fields may be `null` when unsupported. Heading
change may be `null` when encoder direction is unavailable.

### `GET /api/status`

```json
{
  "schema_version": "1.0",
  "system_status": "degraded",
  "connected_nodes": 2,
  "expected_nodes": 3,
  "wifi_connected": true,
  "server_ip": "192.168.1.20",
  "nodes": {
    "gas_node": {"online": true, "last_seen_age_ms": 420, "sensor_status": "ok"},
    "imu_node": {"online": true, "last_seen_age_ms": 390, "sensor_status": "ok"},
    "encoder_node": {"online": false, "last_seen_age_ms": null, "sensor_status": "no_data"}
  }
}
```

`system_status` is `online`, `degraded`, or `offline`, based on Wi-Fi state,
node freshness, and sensor status. `last_seen_age_ms: null` means no valid
message has been accepted since boot.

### `GET /api/alerts`

```json
{
  "schema_version": "1.0",
  "alerts": [
    {"id": 7, "type": "gas_threshold", "source": "gas_node", "status": "active", "value": 1800, "threshold": 1600, "unit": "adc", "occurred_uptime_ms": 12500, "email_status": "not_configured"}
  ]
}
```

Alert status distinguishes active/cleared state from email delivery state;
email status may be `not_configured`, `queued`, `sent`, or `failed`.

### Configuration endpoints

- `GET /api/config` returns non-secret compile-time thresholds, offline
  timeout, and alert cooldown for display. It never returns Wi-Fi or SMTP
  secrets. The initial implementation is read-only.
- `PUT /api/config` is not implemented. The Figma settings view is read-only
  until a protected update API is designed.

## Errors and connection states

Errors use a consistent JSON body where possible:

```json
{"schema_version":"1.0","error":{"code":"invalid_json","message":"Request body is not valid JSON","request_id":42}}
```

Expected status codes: `400` malformed JSON, `404` unknown route, `405` wrong
HTTP method, `413` request too large, `422` valid JSON with invalid schema or
values, and `500` unexpected server failure. Error messages must not expose
credentials. The browser handles network timeout, connection refused and
non-2xx responses as connection/error states, preserves last good readings,
and indicates their age rather than displaying them as current.

## History and simulation

Use `/api/alerts` for alert history. Sensor graph history may initially be
maintained in browser memory from successive `/api/data` samples; persistent
measurement history is not promised by the initial API. Development simulation
must be an explicit separate mode or mock API source and must never be enabled
in production firmware or silently mixed with live readings.
