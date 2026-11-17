# Robot Monitoring System

Modular PlatformIO project for a four-board mobile robot monitoring system.
Stage 2 central API and Stage 3 gas-node implementations are in progress;
IMU/encoder firmware and SMTP remain pending. The Figma frontend is integrated,
with build and LittleFS upload still to verify.

## Current status

- PlatformIO environments and modular source directories are scaffolded.
- Stage 2 central HTTP API modules are implemented. Simulated requests can be
  sent with `tools/simulate_api.ps1` once the central firmware is running.
- Stage 3 gas-node firmware samples MQ-2 ADC values, applies averaging and
  warm-up/hysteresis state, then posts through a queued HTTP task.
- The supplied Figma dashboard is integrated with live API polling and is
  served from LittleFS after the frontend build.
- Architecture, HTTP protocol, setup constraints, and development stages are
  documented under `docs/`.
- The three sensor nodes use the PlatformIO `esp32dev` board definition, as
  specified. The central currently uses `esp32-s3-devkitc-1` as a provisional
  compile profile; verify the exact model before upload.
- The Figma-exported UI layout is preserved; production values come from the
  REST API, while synthetic preview data is isolated to development mode.

## Hardware and build setup

Confirm the central ESP32-S3 model and each sensor/encoder variant. Update the
provisional central board ID in `platformio.ini` if needed. Build the current
central and gas environments from VS Code's PlatformIO terminal:

```sh
pio run -e central_s3
pio run -e gas_node
```

Upload an environment after selecting its serial port and confirming the
connected board:

```sh
pio run -e central_s3 -t upload --upload-port PORT
pio run -e gas_node -t upload --upload-port PORT
pio run -e imu_node -t upload --upload-port PORT
pio run -e encoder_node -t upload --upload-port PORT
```

`PORT` is a placeholder (for example, a COM port on Windows); do not upload
until the target board and port are verified. The central profile is provisional
and is only a compile target until the physical S3 model is confirmed.

See [architecture](docs/architecture.md),
[communication protocol](docs/communication_protocol.md), and
[development roadmap](docs/development_roadmap.md).

Build the imported Figma UI into the LittleFS image directory:

```sh
cd ui/figma-export
corepack pnpm install --frozen-lockfile
corepack pnpm build:esp32
cd ../..
pio run -e central_s3
pio run -e central_s3 -t uploadfs
```

The ESP32-S3 firmware serves the built files from LittleFS at `/`. In local
Vite development, synthetic data is available explicitly at `/?mode=simulation`.
For live local development, set `VITE_API_PROXY_TARGET` to the ESP32-S3 origin
before starting Vite.

After the central firmware is built and running on an ESP32-S3, send explicit
development-only sample traffic from PowerShell:

```powershell
.\tools\simulate_api.ps1 -BaseUrl http://192.168.1.20
```

Replace the example address with the IP printed on the central serial monitor.
The script sends synthetic sample values and reads back data, status, alerts,
and configuration; do not treat those readings as real sensor data.
