#include <Arduino.h>
#include "WiFiManager.h"
#include "HttpServer.h"
#include "NodeMonitor.h"
#include "AlertManager.h"

void setup() {
  Serial.begin(115200);
  delay(50);
  Serial.println("Robot Monitoring System - central API");
  alertManagerBegin();
  nodeMonitorBegin();
  wifiManagerBegin();
  httpServerBegin();
}

void loop() {
  wifiManagerLoop();
  nodeMonitorLoop();
  httpServerLoop();
  delay(2);
}
