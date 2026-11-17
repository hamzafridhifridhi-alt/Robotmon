# HTTP communication protocol (v1 draft)

## Transport

All boards join the same Wi-Fi LAN. The central ESP32-S3 is the HTTP server;
sensor nodes are clients. Use JSON over HTTP initially. No MQTT or ESP-NOW is
part of this design. The central address and port are deployment configuration
(default HTTP port is expected to be 80, subject to firmware implementation).
Requests use finite connect/read timeouts and nodes retry after network errors
with bounded backoff.

## Routes

| Method | Path | Caller | Purpose |
|---|---|---|---|
| POST | `/api/gas` | gas node | Latest gas sample and alarm state |
| POST | `/api/imu` | IMU node | Latest IMU sample and orientation |
| POST | `/api/encoders` | odometry node | Latest encoder/odometry sample |
| GET | `/api/data` | dashboard | Latest accepted snapshots |
| GET | `/api/status` | dashboard | Server and per-node online/freshness state |
| GET | `/api/alerts` | dashboard | Recent and active alerts |
| GET | `/api/config` | dashboard | Non-secret read-only runtime thresholds |

POST bodies are bounded JSON objects. Every message includes `schema_version`,
`node_id`, `uptime_ms` (monotonic node time), `sensor_status`, and `data`. Central receive
time is authoritative for freshness; node uptime is diagnostic and avoids
assuming synchronized clocks. A future protocol revision may add UTC time when
time synchronization is configured.

The current implementation accepts schema `1.0`, and sensor status values
`ok`, `warming_up`, `degraded`, `error`, `disconnected`, or `calibrating`.
Required measurement keys and units are listed in the examples below. Sensor
payloads may include additional keys.

## Example payloads

Gas (ADC values are illustrative; `risk_level` is a configurable indicator,
not a calibrated concentration):

```json
{"schema_version":"1.0","node_id":"gas_node","uptime_ms":123456,"sensor_status":"warming_up","data":{"adc_raw":1200,"voltage_v":0.97,"warmup_complete":false,"risk_level":"unknown","alarm_active":false}}
```

When the ADC pin is unconfigured, the gas node reports sensor failure without
inventing a reading:

```json
{"schema_version":"1.0","node_id":"gas_node","uptime_ms":123456,"sensor_status":"error","data":null}
```

IMU:

```json
{"schema_version":"1.0","node_id":"imu_node","uptime_ms":123456,"sensor_status":"ok","data":{"ax_mps2":0.01,"ay_mps2":0.02,"az_mps2":9.80,"gx_dps":0.1,"gy_dps":-0.2,"gz_dps":0.0,"roll_deg":0.12,"pitch_deg":-0.08}}
```

Odometry:

```json
{"schema_version":"1.0","node_id":"encoder_node","uptime_ms":123456,"sensor_status":"ok","data":{"left_rpm":0.0,"right_rpm":0.0,"left_distance_m":0.0,"right_distance_m":0.0,"distance_m":0.0,"linear_speed_mps":0.0,"heading_change_rad":null}}
```

Examples illustrate field shape only; they are not hardware readings, pin
choices, calibration values, or guarantees that optional values are available.

## Validation and response behavior

The server must check route-to-node identity, required keys and JSON types,
finite numeric values, status length, body size, and supported schema. Reject
malformed or mismatched messages with 4xx status and a compact JSON error.
Accepted messages receive 200 or 202. Nodes handle non-2xx responses without
blocking their sampling loop and do not treat a failed send as sensor failure.
Unknown keys may be ignored for forward compatibility, while required fields
remain strict. Exact bounds will be set with sensor ranges in Stage 2.

The Stage 2 implementation returns `202` with `schema_version`, `accepted`,
`node_id`, and `received_uptime_ms` for accepted posts. JSON errors have the
shape `{"schema_version":"1.0","error":{"code":"...","message":"...","request_id":123}}`.
Malformed JSON is `400`; invalid schema/fields are `422`; oversized bodies are
`413`; unsupported methods are `405`; unknown API routes are `404`.

## Freshness and node status

`last_seen_ms` is recorded only after successful validation. A configurable
timeout determines online/offline state. Status responses expose node ID,
online state, last communication age, last sensor status and last update age.
Dashboard polling interval and node transmission intervals are independently
configurable to limit unnecessary traffic.

The live implementation returns the age as `last_seen_age_ms` (or `null` if
there has never been a valid post), plus `connected_nodes`, `expected_nodes`,
`system_status`, Wi-Fi connection state, and server IP when connected.
`GET /api/data` returns latest node snapshots, each node's `node_uptime_ms`,
and server uptime. The browser uses node uptime to avoid duplicating chart points
when it polls faster than a node publishes. Alert records
use `occurred_uptime_ms` because UTC time synchronization is not configured;
email state is `not_configured` in Stage 2.

## Security scope

Initial HTTP is intended for a trusted local network. It does not provide
transport encryption or authentication. Do not expose the central server to
the public internet; network isolation and credentials are deployment
concerns for later review.
