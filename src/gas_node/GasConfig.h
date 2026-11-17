#pragma once

// Hardware and calibration placeholders. Confirm the exact MQ-2 module,
// voltage conditioning, and board pinout before connecting or uploading.
#define MQ2_ADC_PIN -1
#define MQ2_ADC_ATTENUATION ADC_11db
#define MQ2_DIVIDER_RATIO 1.0f  // ADC pin voltage -> module output; measure/set this.

#define GAS_SAMPLE_INTERVAL_MS 100UL
#define GAS_TRANSMIT_INTERVAL_MS 1000UL
#define GAS_AVERAGING_WINDOW 8
#define GAS_WARMUP_DURATION_MS 60000UL  // Provisional; follow the module guidance.
#define GAS_ALARM_THRESHOLD_ADC 1600
#define GAS_ALARM_RESET_ADC 1450

#define GAS_HTTP_TIMEOUT_MS 1500UL
#define GAS_WIFI_RETRY_INTERVAL_MS 10000UL
#define CENTRAL_SERVER_HOST "SET_CENTRAL_IP_OR_HOSTNAME"
#define CENTRAL_SERVER_PORT 80
