#include "NodeMonitor.h"
#include <ArduinoJson.h>
#include "SensorDataManager.h"
#include "AlertManager.h"
#include "WiFiManager.h"
#include "project_config.h"

namespace {
bool wasOnline[3]{};
bool initialized[3]{};
bool offlineAnnounced[3]{};
uint32_t monitorStartedMs = 0;
const SensorNode nodes[] = {SensorNode::Gas, SensorNode::Imu, SensorNode::Encoders};
}

void nodeMonitorBegin() { monitorStartedMs = millis(); }

void nodeMonitorLoop() {
  for (uint8_t i = 0; i < 3; ++i) {
    const NodeSnapshot snapshot = sensorDataSnapshot(nodes[i]);
    const bool online = snapshot.hasData && static_cast<uint32_t>(millis() - snapshot.lastSeenMs) <= NODE_OFFLINE_TIMEOUT_MS;
    if (initialized[i] && wasOnline[i] != online && online) {
      alertManagerNodeState(sensorDataNodeId(nodes[i]), online, online);
      offlineAnnounced[i] = false;
    } else if (!online && !offlineAnnounced[i] && static_cast<uint32_t>(millis() - monitorStartedMs) >= NODE_OFFLINE_TIMEOUT_MS) {
      alertManagerNodeState(sensorDataNodeId(nodes[i]), false, false);
      offlineAnnounced[i] = true;
    }
    initialized[i] = true;
    wasOnline[i] = online;
  }
}

String nodeMonitorStatusJson() {
  JsonDocument doc;
  doc["schema_version"] = "1.0";
  JsonObject nodesObj = doc["nodes"].to<JsonObject>();
  uint8_t onlineCount = 0;
  bool allSensorsHealthy = true;
  for (SensorNode node : nodes) {
    const NodeSnapshot snapshot = sensorDataSnapshot(node);
    const bool online = snapshot.hasData && static_cast<uint32_t>(millis() - snapshot.lastSeenMs) <= NODE_OFFLINE_TIMEOUT_MS;
    if (online) ++onlineCount;
    if (!snapshot.hasData || strcmp(snapshot.sensorStatus, "ok") != 0) allSensorsHealthy = false;
    JsonObject entry = nodesObj[sensorDataNodeId(node)].to<JsonObject>();
    entry["online"] = online;
    if (snapshot.hasData) entry["last_seen_age_ms"] = static_cast<uint32_t>(millis() - snapshot.lastSeenMs);
    else entry["last_seen_age_ms"] = nullptr;
    entry["sensor_status"] = snapshot.hasData ? snapshot.sensorStatus : "no_data";
  }
  doc["connected_nodes"] = onlineCount;
  doc["expected_nodes"] = 3;
  doc["wifi_connected"] = wifiManagerConnected();
  doc["system_status"] = !wifiManagerConnected() || onlineCount == 0 ? "offline" : onlineCount == 3 && allSensorsHealthy ? "online" : "degraded";
  if (wifiManagerConnected()) doc["server_ip"] = wifiManagerAddress();
  else doc["server_ip"] = nullptr;
  String output;
  serializeJson(doc, output);
  return output;
}
