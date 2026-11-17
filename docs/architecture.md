# System architecture

## Overview

Three independent ESP32 Dev Module sensor nodes join the same Wi-Fi LAN as a central
ESP32-S3. Each sensor node periodically sends a JSON HTTP POST to the central
server. The ESP32-S3 validates and retains the latest node snapshots, tracks
node freshness, serves a local browser dashboard and later owns alert history
and SMTP delivery. A laptop opens the dashboard using the central node's LAN
address. Internet access for SMTP comes from the Wi-Fi router/network; an
ESP32 soft access point alone is not assumed to provide internet connectivity.

```text
MQ-2 -> gas ESP32 --------\
IMU   -> IMU ESP32 --------+--> Wi-Fi router/LAN <--> central ESP32-S3
Encoders -> odometry ESP32-/                              |       |
                                               local dashboard    SMTP
                                                     |        internet/router
                                                   laptop
```

## Responsibilities and boundaries

- **Gas node:** sample MQ-2 analog output, filter readings, track warm-up and
  threshold/hysteresis state, and report ADC/voltage/status. Sampling remains
  separate from a queued HTTP worker. It must not report ppm unless a
  documented calibration supports that result.
- **IMU node:** isolate the selected sensor behind a replaceable driver,
  acquire supported acceleration/gyro axes, estimate roll/pitch and report
  sensor validity. MPU6050 is an optional initial driver, not a hardware
  selection. Six-axis yaw drifts without an external heading reference.
- **Odometry node:** count encoder edges with short ISRs, calculate wheel and
  robot motion in the main/task context, and report the configured geometry
  and validity. Single-channel signals do not independently indicate direction.
- **Central ESP32-S3:** expose HTTP API and static files, validate each node's
  messages, keep latest snapshots and last-seen times, detect online/offline
  changes, maintain alert history, and enqueue SMTP work away from request
  handling.
- **Laptop:** browser client only; it polls local APIs and contains no secrets.

## Firmware module plan

The source tree reserves separate environment roots. The three sensor-node
PlatformIO environments currently target `esp32dev`; this is the user's
provisional board assumption and can be revised if the hardware differs. The
central ESP32-S3 board ID remains to be confirmed. Central responsibilities
will be split into Wi-Fi, HTTP, data, alert, node-monitor and SMTP modules. Each
sensor node will separate its sensor/math driver from HTTP transport and its
main scheduler. Stage 2 currently implements the central API only; sensor-node
firmware remains for later stages.

## Network and resilience

Use the existing Wi-Fi router for all four boards. Configure central address
discovery (DHCP reservation is recommended for a stable URL) after the network
details are known. Nodes reconnect with bounded retry/backoff and finite HTTP
timeouts. The central marks a node offline when its last valid message is
older than a configurable timeout; recovery is a state transition. Email
delivery is queued and rate-limited so SMTP latency does not stall API handling.

## Safety and measurement limits

MQ-2 modules commonly use 5 V and some expose analog voltage above ESP32 ADC
limits. Confirm the exact module output and add an appropriately rated divider
or level conditioning before connecting it. This prototype is not a certified
life-safety device. IMU orientation accuracy depends on calibration and
filtering. Odometry accumulates wheel slip and geometry error; it is an
estimate, not absolute localization.

## Unresolved hardware and deployment inputs

See [wiring diagrams](wiring_diagrams.md), [calibration](sensor_calibration.md),
and [roadmap](development_roadmap.md) for the complete confirmation list.
