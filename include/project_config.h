#pragma once

// Shared project defaults. Fill hardware-dependent values after confirming
// sensors, wiring, and encoder specifications. Thresholds are provisional
// software defaults and require calibration before field use.

#define PROJECT_NAME "Robot Monitoring System"

// Central server settings (Stage 2 defaults; tune after observing the LAN).
#define CENTRAL_HTTP_PORT 80
#define NODE_OFFLINE_TIMEOUT_MS 10000UL
#define HTTP_MAX_BODY_BYTES 768
#define GAS_ALARM_THRESHOLD_ADC 1600
#define GAS_ALARM_RESET_ADC 1450
#define IMU_MAX_INCLINATION_DEG 35.0f
#define IMU_MAX_ACCEL_MPS2 25.0f
#define ALERT_COOLDOWN_MS 60000UL
#define ALERT_HISTORY_CAPACITY 20

// Wi-Fi values come from ignored include/secrets.h when available.

// Wi-Fi and central server configuration belongs in a private configuration
// header created locally; never commit credentials.

// Hardware parameters intentionally unset:
// - central ESP32-S3 board ID (sensor nodes currently assume esp32dev)
// - MQ-2 ADC pin, ADC attenuation/reference, divider ratio and voltage limit
// - IMU model, I2C pins/address, ranges and sample rate
// - encoder pins/type, pulses per revolution, gear ratio, wheel diameter/base
// - node IP addressing or DHCP reservation strategy
