#pragma once

#include <Arduino.h>

enum class SensorNode : uint8_t { Gas = 0, Imu = 1, Encoders = 2, Invalid = 255 };

struct NodeSnapshot {
  bool hasData;
  uint32_t lastSeenMs;
  uint32_t nodeUptimeMs;
  char sensorStatus[24];
  char dataJson[640];
};

SensorNode sensorDataNodeForPath(const String& path);
const char* sensorDataNodeId(SensorNode node);
bool sensorDataAccept(SensorNode node, const String& body, String& errorCode, String& errorMessage);
NodeSnapshot sensorDataSnapshot(SensorNode node);
String sensorDataAllJson();
