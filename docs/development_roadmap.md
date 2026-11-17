# Development roadmap and open hardware inputs

## Stages

1. **Architecture and scaffold (complete):** directory tree, PlatformIO
   environments, configuration templates, protocol, documentation and open
   hardware list.
2. **Central server (in progress):** Wi-Fi, HTTP API, validation, node
   freshness, simulated request checks, and modular central firmware. Build
   verification is currently blocked by PlatformIO dependency access.
3. **Gas node (in progress):** MQ-2 sampling/filter/warm-up/alarm state and
   HTTP client. Build verification is blocked while PlatformIO cannot download
   the Espressif platform in this environment.
4. **IMU node:** replaceable driver, optional MPU6050 implementation, sensor
   fusion and HTTP client.
5. **Encoder node:** interrupt pulse counts, RPM and differential odometry.
6. **Dashboard (in progress):** supplied Figma React/Vite export is integrated
   with live API polling, controller-derived settings/status, browser sample
   history, and development-only simulation. Build and LittleFS runtime
   verification remain pending dependency access and hardware.
7. **SMTP:** queued alert notifications and simulated alert checks.
8. **Integration:** four-board reconnect, fault, alert and dashboard behavior.
9. **Final system review:** update docs with confirmed hardware and measured
   validation results.

The central environment uses a provisional `esp32-s3-devkitc-1` compile
profile because the physical S3 model is not yet known. Verify the exact board
before uploading. The three sensor-node environments use `esp32dev`.

## Hardware and deployment questions to resolve

- Exact PlatformIO board ID/revision for the central ESP32-S3; sensor-node
  boards are provisionally treated as standard ESP32 Dev Modules (`esp32dev`)
  unless later corrected. Confirm USB serial/upload ports.
- Wi-Fi LAN details and whether the router can reserve a stable central IP.
- MQ-2 module/schematic, supply, maximum analog output, safe conditioning,
  ADC-capable pin, ADC configuration, sample/average interval, thresholds,
  hysteresis and warm-up duration.
- IMU model, I2C pinout/address, supply/logic levels, supported gyro, ranges,
  sample interval and mounting orientation.
- Encoder model and output type, pin choices, pulse/count convention, counts
  per revolution, gear ratio, wheel diameter, wheel separation and sample rate.
- Desired node transmit intervals, online timeout, dashboard polling interval.
- SMTP provider/host/port/TLS/authentication and sender/recipient addresses.
- Alert thresholds, cooldown, history retention, timezone/time source and
  whether UTC synchronization is required.

No hardware pin, voltage divider, sensor calibration, or wheel parameter is
finalized. The current gas warm-up and ADC threshold values are provisional
software defaults and must be calibrated for the exact module.
