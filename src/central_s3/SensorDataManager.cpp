#include "SensorDataManager.h"
#include <ArduinoJson.h>
#include <math.h>
#include <string.h>
#include "project_config.h"

namespace {
constexpr size_t DATA_CAPACITY = 560;
NodeSnapshot snapshots[3]{};

bool finiteNumber(JsonVariantConst value) {
  if (value.isNull() || (!value.is<float>() && !value.is<double>() && !value.is<int>() && !value.is<long>())) return false;
  const double number = value.as<double>();
  return isfinite(number);
}

bool requiredNumber(JsonObjectConst data, const char* key) {
  const JsonVariantConst value = data[key];
  return finiteNumber(value);
}

bool checkPayload(SensorNode node, JsonObjectConst data, String& code, String& message) {
  auto fail = [&](const char* text) { code = "invalid_measurement"; message = text; return false; };
  if (node == SensorNode::Gas) {
    if (!data["adc_raw"].is<int>() || data["adc_raw"].as<int>() < 0 || data["adc_raw"].as<int>() > 65535) return fail("adc_raw must be an integer from 0 to 65535");
    if (!requiredNumber(data, "voltage_v")) return fail("voltage_v must be a finite number");
    if (!data["alarm_active"].is<bool>()) return fail("alarm_active must be boolean");
    if (data["warmup_complete"].is<JsonVariantConst>() && !data["warmup_complete"].is<bool>()) return fail("warmup_complete must be boolean");
  } else if (node == SensorNode::Imu) {
    const char* axes[] = {"ax_mps2", "ay_mps2", "az_mps2"};
    for (const char* axis : axes) if (!requiredNumber(data, axis)) return fail("acceleration axes must be finite numbers");
    const char* gyro[] = {"gx_dps", "gy_dps", "gz_dps"};
    for (const char* axis : gyro) if (!data[axis].isNull() && !finiteNumber(data[axis])) return fail("gyro axes must be finite numbers or null");
    if (!requiredNumber(data, "roll_deg") || !requiredNumber(data, "pitch_deg")) return fail("roll_deg and pitch_deg must be finite numbers");
  } else if (node == SensorNode::Encoders) {
    const char* values[] = {"left_rpm", "right_rpm", "left_distance_m", "right_distance_m", "distance_m", "linear_speed_mps"};
    for (const char* key : values) if (!requiredNumber(data, key)) return fail("odometry measurements must be finite numbers");
    if (!data["heading_change_rad"].isNull() && !finiteNumber(data["heading_change_rad"])) return fail("heading_change_rad must be a finite number or null");
  }
  return true;
}
}

SensorNode sensorDataNodeForPath(const String& path) {
  if (path == "/api/gas") return SensorNode::Gas;
  if (path == "/api/imu") return SensorNode::Imu;
  if (path == "/api/encoders") return SensorNode::Encoders;
  return SensorNode::Invalid;
}

const char* sensorDataNodeId(SensorNode node) {
  switch (node) {
    case SensorNode::Gas: return "gas_node";
    case SensorNode::Imu: return "imu_node";
    case SensorNode::Encoders: return "encoder_node";
    default: return "unknown";
  }
}

bool sensorDataAccept(SensorNode node, const String& body, String& errorCode, String& errorMessage) {
  if (node == SensorNode::Invalid) { errorCode = "unknown_node"; errorMessage = "Unknown node route"; return false; }
  JsonDocument doc;
  const DeserializationError parseError = deserializeJson(doc, body);
  if (parseError) { errorCode = "invalid_json"; errorMessage = "Request body is not valid JSON"; return false; }
  if (doc["schema_version"] != "1.0") { errorCode = "unsupported_schema"; errorMessage = "schema_version must be 1.0"; return false; }
  if (!doc["node_id"].is<const char*>()) { errorCode = "missing_node_id"; errorMessage = "node_id is required"; return false; }
  if (strcmp(doc["node_id"].as<const char*>(), sensorDataNodeId(node)) != 0) { errorCode = "node_mismatch"; errorMessage = "node_id does not match this endpoint"; return false; }
  if (!doc["uptime_ms"].is<uint32_t>()) { errorCode = "invalid_uptime"; errorMessage = "uptime_ms must be an unsigned integer"; return false; }
  if (!doc["sensor_status"].is<const char*>()) { errorCode = "missing_sensor_status"; errorMessage = "sensor_status is required"; return false; }
  const char* status = doc["sensor_status"].as<const char*>();
  if (strlen(status) >= sizeof(snapshots[0].sensorStatus)) { errorCode = "invalid_sensor_status"; errorMessage = "sensor_status is too long"; return false; }
  const char* allowedStatuses[] = {"ok", "warming_up", "degraded", "error", "disconnected", "calibrating"};
  bool recognizedStatus = false;
  for (const char* allowed : allowedStatuses) if (strcmp(status, allowed) == 0) recognizedStatus = true;
  if (!recognizedStatus) { errorCode = "invalid_sensor_status"; errorMessage = "sensor_status is not a supported value"; return false; }
  const bool sensorFault = strcmp(status, "error") == 0 || strcmp(status, "disconnected") == 0;
  const JsonVariantConst dataField = doc["data"];
  if (sensorFault && dataField.isNull() && !dataField.isUnbound()) {
    NodeSnapshot& target = snapshots[static_cast<uint8_t>(node)];
    strlcpy(target.dataJson, "null", sizeof(target.dataJson));
    strlcpy(target.sensorStatus, status, sizeof(target.sensorStatus));
    target.lastSeenMs = millis();
    target.nodeUptimeMs = doc["uptime_ms"].as<uint32_t>();
    target.hasData = true;
    return true;
  }
  JsonObjectConst data = doc["data"].as<JsonObjectConst>();
  if (data.isNull()) { errorCode = "missing_data"; errorMessage = "data object is required"; return false; }
  if (!checkPayload(node, data, errorCode, errorMessage)) return false;

  char compact[DATA_CAPACITY];
  const size_t written = serializeJson(data, compact, sizeof(compact));
  if (written == 0 || written >= sizeof(compact)) { errorCode = "payload_too_large"; errorMessage = "data object exceeds storage capacity"; return false; }
  NodeSnapshot& target = snapshots[static_cast<uint8_t>(node)];
  memcpy(target.dataJson, compact, written + 1);
  strlcpy(target.sensorStatus, status, sizeof(target.sensorStatus));
  target.lastSeenMs = millis();
  target.nodeUptimeMs = doc["uptime_ms"].as<uint32_t>();
  target.hasData = true;
  return true;
}

NodeSnapshot sensorDataSnapshot(SensorNode node) {
  if (node == SensorNode::Invalid) return {};
  return snapshots[static_cast<uint8_t>(node)];
}

String sensorDataAllJson() {
  String result;
  result.reserve(1800);
  result = "{\"gas_node\":";
  for (uint8_t i = 0; i < 3; ++i) {
    const NodeSnapshot& item = snapshots[i];
    if (!item.hasData) result += "{\"sensor_status\":\"no_data\",\"node_uptime_ms\":null,\"last_seen_age_ms\":null,\"data\":null}";
    else {
      result += "{\"sensor_status\":\""; result += item.sensorStatus;
      result += "\",\"node_uptime_ms\":"; result += String(item.nodeUptimeMs);
      result += ",\"last_seen_age_ms\":"; result += String(static_cast<uint32_t>(millis() - item.lastSeenMs));
      result += ",\"data\":"; result += item.dataJson; result += "}";
    }
    if (i == 0) result += ",\"imu_node\":";
    else if (i == 1) result += ",\"encoder_node\":";
  }
  result += "}";
  return result;
}
