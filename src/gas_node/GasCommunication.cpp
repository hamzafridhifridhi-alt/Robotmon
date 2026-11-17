#include "GasCommunication.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <WiFiClient.h>
#include <ArduinoJson.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>
#include <string.h>
#include "GasConfig.h"

#if __has_include("secrets.h")
#include "secrets.h"
#endif
#ifndef WIFI_SSID
#define WIFI_SSID "CONFIGURE_WIFI_SSID"
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD "CONFIGURE_WIFI_PASSWORD"
#endif

namespace {
struct PendingGasMessage {
  bool valid;
  uint32_t uptimeMs;
  uint16_t adcRaw;
  float voltageV;
  bool warmupComplete;
  bool alarmActive;
  char riskLevel[12];
  char sensorStatus[20];
};

QueueHandle_t messageQueue = nullptr;

void setStatus(PendingGasMessage& message, const char* value) {
  strlcpy(message.sensorStatus, value, sizeof(message.sensorStatus));
}

void postWorker(void*) {
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  uint32_t lastWifiRetry = millis();
  PendingGasMessage pending{};
  for (;;) {
    if (xQueueReceive(messageQueue, &pending, pdMS_TO_TICKS(100)) != pdTRUE) continue;

    if (WiFi.status() != WL_CONNECTED) {
      const uint32_t now = millis();
      if (static_cast<uint32_t>(now - lastWifiRetry) >= GAS_WIFI_RETRY_INTERVAL_MS) {
        lastWifiRetry = now;
        WiFi.disconnect();
        WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
      }
      continue;
    }

    JsonDocument doc;
    doc["schema_version"] = "1.0";
    doc["node_id"] = "gas_node";
    doc["uptime_ms"] = pending.uptimeMs;
    doc["sensor_status"] = pending.sensorStatus;
    if (pending.valid) {
      JsonObject data = doc["data"].to<JsonObject>();
      data["adc_raw"] = pending.adcRaw;
      data["voltage_v"] = pending.voltageV;
      data["warmup_complete"] = pending.warmupComplete;
      data["risk_level"] = pending.riskLevel;
      data["alarm_active"] = pending.alarmActive;
    } else {
      doc["data"] = nullptr;
    }

    String body;
    body.reserve(256);
    serializeJson(doc, body);
    const String url = String("http://") + CENTRAL_SERVER_HOST + ":" + String(CENTRAL_SERVER_PORT) + "/api/gas";
    WiFiClient client;
    HTTPClient http;
    http.setConnectTimeout(GAS_HTTP_TIMEOUT_MS);
    http.setTimeout(GAS_HTTP_TIMEOUT_MS);
    if (http.begin(client, url)) {
      http.addHeader("Content-Type", "application/json");
      const int code = http.POST(body);
      if (code < 200 || code >= 300) Serial.printf("Gas POST failed: HTTP %d\n", code);
      http.end();
    } else {
      Serial.println("Gas POST could not initialize HTTP client");
    }
  }
}

void submit(const PendingGasMessage& message) {
  if (messageQueue != nullptr) xQueueOverwrite(messageQueue, &message);
}
}

void gasCommunicationBegin() {
  messageQueue = xQueueCreate(1, sizeof(PendingGasMessage));
  if (messageQueue == nullptr) {
    Serial.println("Unable to allocate gas communication queue");
    return;
  }
  if (xTaskCreate(postWorker, "gas_http", 6144, nullptr, 1, nullptr) != pdPASS) {
    Serial.println("Unable to start gas HTTP task");
  }
}

void gasCommunicationSubmit(const GasReading& reading, const char* sensorStatus) {
  PendingGasMessage message{};
  message.valid = true;
  message.uptimeMs = millis();
  message.adcRaw = reading.adcRaw;
  message.voltageV = reading.voltageV;
  message.warmupComplete = reading.warmupComplete;
  message.alarmActive = reading.alarmActive;
  strlcpy(message.riskLevel, reading.riskLevel, sizeof(message.riskLevel));
  setStatus(message, sensorStatus);
  submit(message);
}

void gasCommunicationSubmitError(const char* sensorStatus) {
  PendingGasMessage message{};
  message.valid = false;
  message.uptimeMs = millis();
  setStatus(message, sensorStatus);
  submit(message);
}
