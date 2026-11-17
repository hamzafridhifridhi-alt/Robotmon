#include "AlertManager.h"
#include <ArduinoJson.h>
#include <math.h>
#include "project_config.h"

namespace {
struct AlertRecord {
  uint32_t id;
  uint32_t occurredMs;
  char type[24];
  char source[20];
  char unit[12];
  float value;
  float threshold;
  bool active;
};
AlertRecord records[ALERT_HISTORY_CAPACITY]{};
uint8_t count = 0;
uint8_t next = 0;
uint32_t nextId = 1;
bool conditionActive[8]{};
bool nodeOffline[3]{};
bool gasAlarmActive = false;

int typeIndex(const char* type) {
  const char* names[] = {"gas_threshold", "imu_inclination", "imu_acceleration", "node_offline", "node_recovered"};
  for (int i = 0; i < 5; ++i) if (strcmp(type, names[i]) == 0) return i;
  return 7;
}

void appendRecord(const char* type, const char* source, bool active, float value, float threshold, const char* unit) {
  AlertRecord& record = records[next];
  record.id = nextId++;
  record.occurredMs = millis();
  strlcpy(record.type, type, sizeof(record.type));
  strlcpy(record.source, source, sizeof(record.source));
  strlcpy(record.unit, unit, sizeof(record.unit));
  record.value = value;
  record.threshold = threshold;
  record.active = active;
  next = (next + 1) % ALERT_HISTORY_CAPACITY;
  if (count < ALERT_HISTORY_CAPACITY) ++count;
}

void condition(const char* type, const char* source, bool active, float value, float threshold, const char* unit) {
  const int idx = typeIndex(type);
  if (idx >= 8 || conditionActive[idx] == active) return;
  conditionActive[idx] = active;
  if (!active) {
    for (uint8_t n = 0; n < count; ++n) {
      AlertRecord& record = records[(next + ALERT_HISTORY_CAPACITY - count + n) % ALERT_HISTORY_CAPACITY];
      if (record.active && strcmp(record.type, type) == 0 && strcmp(record.source, source) == 0) record.active = false;
    }
    return;
  }
  appendRecord(type, source, true, value, threshold, unit);
}
}

void alertManagerBegin() {}

void alertManagerEvaluate(SensorNode node) {
  NodeSnapshot snapshot = sensorDataSnapshot(node);
  if (!snapshot.hasData) return;
  if (strcmp(snapshot.sensorStatus, "error") == 0 || strcmp(snapshot.sensorStatus, "disconnected") == 0 || strcmp(snapshot.dataJson, "null") == 0) return;
  JsonDocument data;
  if (deserializeJson(data, snapshot.dataJson)) return;
  if (node == SensorNode::Gas) {
    const int raw = data["adc_raw"] | 0;
    const bool warm = data["warmup_complete"] | false;
    if (!warm || raw <= GAS_ALARM_RESET_ADC) gasAlarmActive = false;
    else if (raw >= GAS_ALARM_THRESHOLD_ADC) gasAlarmActive = true;
    condition("gas_threshold", "gas_node", gasAlarmActive, raw, GAS_ALARM_THRESHOLD_ADC, "adc");
  } else if (node == SensorNode::Imu) {
    const float roll = data["roll_deg"] | 0.0f;
    const float pitch = data["pitch_deg"] | 0.0f;
    const float angle = fmaxf(fabsf(roll), fabsf(pitch));
    condition("imu_inclination", "imu_node", angle > IMU_MAX_INCLINATION_DEG, angle, IMU_MAX_INCLINATION_DEG, "deg");
    const float ax = data["ax_mps2"] | 0.0f;
    const float ay = data["ay_mps2"] | 0.0f;
    const float az = data["az_mps2"] | 0.0f;
    const float magnitude = sqrtf(ax * ax + ay * ay + az * az);
    condition("imu_acceleration", "imu_node", magnitude > IMU_MAX_ACCEL_MPS2, magnitude, IMU_MAX_ACCEL_MPS2, "m/s2");
  }
}

void alertManagerNodeState(const char* nodeId, bool online, bool recovered) {
  uint8_t index = strcmp(nodeId, "gas_node") == 0 ? 0 : strcmp(nodeId, "imu_node") == 0 ? 1 : 2;
  if (!recovered && !online && !nodeOffline[index]) {
    nodeOffline[index] = true;
    appendRecord("node_offline", nodeId, true, 0.0f, 0.0f, "state");
    return;
  }
  if (recovered && online && nodeOffline[index]) {
    nodeOffline[index] = false;
    for (uint8_t n = 0; n < count; ++n) {
      AlertRecord& record = records[(next + ALERT_HISTORY_CAPACITY - count + n) % ALERT_HISTORY_CAPACITY];
      if (record.active && strcmp(record.type, "node_offline") == 0 && strcmp(record.source, nodeId) == 0) record.active = false;
    }
    appendRecord("node_recovered", nodeId, false, 0.0f, 0.0f, "state");
  }
}

String alertManagerJson() {
  JsonDocument doc;
  doc["schema_version"] = "1.0";
  JsonArray alerts = doc["alerts"].to<JsonArray>();
  for (uint8_t n = 0; n < count; ++n) {
    const AlertRecord& record = records[(next + ALERT_HISTORY_CAPACITY - count + n) % ALERT_HISTORY_CAPACITY];
    JsonObject item = alerts.add<JsonObject>();
    item["id"] = record.id;
    item["type"] = record.type;
    item["source"] = record.source;
    item["status"] = record.active ? "active" : "cleared";
    item["value"] = record.value;
    item["threshold"] = record.threshold;
    item["unit"] = record.unit;
    item["occurred_uptime_ms"] = record.occurredMs;
    item["email_status"] = "not_configured";
  }
  String output;
  serializeJson(doc, output);
  return output;
}
