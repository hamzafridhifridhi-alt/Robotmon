#include <Arduino.h>
#include <WiFi.h>
#include "WiFiManager.h"

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
constexpr uint32_t RETRY_INTERVAL_MS = 10000;
uint32_t lastAttemptMs = 0;
bool connectionStateKnown = false;
bool wasConnected = false;

void onWiFiEvent(WiFiEvent_t event, WiFiEventInfo_t info) {
  if (event == ARDUINO_EVENT_WIFI_STA_DISCONNECTED) {
    // ESP-IDF disconnect reason codes help diagnose router/authentication
    // issues without ever logging the configured SSID or password.
    Serial.printf("Wi-Fi disconnect reason: %u\n",
                  static_cast<unsigned>(info.wifi_sta_disconnected.reason));
  }
}
}

void wifiManagerBegin() {
  WiFi.onEvent(onWiFiEvent);
  WiFi.mode(WIFI_STA);
  WiFi.setAutoReconnect(true);
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  lastAttemptMs = millis();
}

void wifiManagerLoop() {
  const bool connected = WiFi.status() == WL_CONNECTED;
  if (!connectionStateKnown || connected != wasConnected) {
    connectionStateKnown = true;
    wasConnected = connected;
    if (connected) Serial.printf("Wi-Fi connected; server IP: %s\n", WiFi.localIP().toString().c_str());
    else Serial.println("Wi-Fi disconnected; retrying automatically");
  }
  if (connected) return;
  const uint32_t now = millis();
  if (static_cast<uint32_t>(now - lastAttemptMs) < RETRY_INTERVAL_MS) return;
  lastAttemptMs = now;
  WiFi.disconnect();
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
}

bool wifiManagerConnected() { return WiFi.status() == WL_CONNECTED; }

String wifiManagerAddress() {
  return wifiManagerConnected() ? WiFi.localIP().toString() : String();
}
