#include "HttpServer.h"
#include <Arduino.h>
#include <WebServer.h>
#include <ArduinoJson.h>
#include <LittleFS.h>
#include "SensorDataManager.h"
#include "NodeMonitor.h"
#include "AlertManager.h"
#include "WiFiManager.h"
#include "project_config.h"

namespace {
WebServer server(CENTRAL_HTTP_PORT);
bool started = false;
bool filesystemReady = false;

void sendJson(int code, const String& body) {
  server.sendHeader("Cache-Control", "no-store");
  server.send(code, "application/json", body);
}

void sendError(int status, const char* code, const char* message) {
  JsonDocument doc;
  doc["schema_version"] = "1.0";
  JsonObject error = doc["error"].to<JsonObject>();
  error["code"] = code;
  error["message"] = message;
  error["request_id"] = millis();
  String body;
  serializeJson(doc, body);
  sendJson(status, body);
}

void handlePost() {
  const String path = server.uri();
  if (sensorDataNodeForPath(path) == SensorNode::Invalid) { sendError(404, "not_found", "Unknown API route"); return; }
  if (!server.hasArg("plain")) { sendError(400, "missing_body", "JSON request body is required"); return; }
  const String body = server.arg("plain");
  if (body.length() > HTTP_MAX_BODY_BYTES) { sendError(413, "body_too_large", "Request body exceeds configured limit"); return; }
  String code, message;
  const SensorNode node = sensorDataNodeForPath(path);
  if (!sensorDataAccept(node, body, code, message)) {
    const int httpCode = code == "invalid_json" ? 400 : code == "payload_too_large" ? 413 : 422;
    sendError(httpCode, code.c_str(), message.c_str());
    return;
  }
  alertManagerEvaluate(node);
  JsonDocument response;
  response["schema_version"] = "1.0";
  response["accepted"] = true;
  response["node_id"] = sensorDataNodeId(node);
  response["received_uptime_ms"] = millis();
  String output;
  serializeJson(response, output);
  sendJson(202, output);
}

void handleData() {
  String body;
  body.reserve(2100);
  body = "{\"schema_version\":\"1.0\",\"server_uptime_ms\":";
  body += String(millis());
  body += ",\"nodes\":";
  body += sensorDataAllJson();
  body += "}";
  sendJson(200, body);
}

void handleConfig() {
  JsonDocument doc;
  doc["schema_version"] = "1.0";
  JsonObject thresholds = doc["thresholds"].to<JsonObject>();
  thresholds["gas_alarm_adc"] = GAS_ALARM_THRESHOLD_ADC;
  thresholds["gas_alarm_reset_adc"] = GAS_ALARM_RESET_ADC;
  thresholds["imu_max_inclination_deg"] = IMU_MAX_INCLINATION_DEG;
  thresholds["imu_max_acceleration_mps2"] = IMU_MAX_ACCEL_MPS2;
  doc["node_offline_timeout_ms"] = NODE_OFFLINE_TIMEOUT_MS;
  doc["alert_cooldown_ms"] = ALERT_COOLDOWN_MS;
  doc["read_only"] = true;
  String output;
  serializeJson(doc, output);
  sendJson(200, output);
}

void handleRoot() {
  if (filesystemReady && LittleFS.exists("/index.html")) {
    File file = LittleFS.open("/index.html", "r");
    server.sendHeader("Cache-Control", "no-cache");
    server.streamFile(file, "text/html");
    file.close();
    return;
  }
  server.send(200, "text/plain", "Robot Monitoring System API is running. Build the Figma frontend and upload the LittleFS image to serve it here.");
}

const char* contentTypeForPath(const String& path) {
  if (path.endsWith(".html")) return "text/html";
  if (path.endsWith(".css")) return "text/css";
  if (path.endsWith(".js")) return "application/javascript";
  if (path.endsWith(".json")) return "application/json";
  if (path.endsWith(".png")) return "image/png";
  if (path.endsWith(".svg")) return "image/svg+xml";
  if (path.endsWith(".ico")) return "image/x-icon";
  if (path.endsWith(".woff2")) return "font/woff2";
  return "application/octet-stream";
}

bool serveStaticFile() {
  if (!filesystemReady) return false;
  String path = server.uri();
  if (path.indexOf("..") >= 0) return false;
  if (path == "/") path = "/index.html";
  if (!LittleFS.exists(path)) return false;
  File file = LittleFS.open(path, "r");
  if (!file || file.isDirectory()) { file.close(); return false; }
  server.sendHeader("Cache-Control", path.endsWith(".html") ? "no-cache" : "public, max-age=86400");
  server.streamFile(file, contentTypeForPath(path));
  file.close();
  return true;
}

void handleNotFound() {
  const String path = server.uri();
  const bool known = path == "/api/gas" || path == "/api/imu" || path == "/api/encoders" || path == "/api/data" || path == "/api/status" || path == "/api/alerts" || path == "/api/config";
  if (known) sendError(405, "method_not_allowed", "HTTP method is not supported for this route");
  else if (path.startsWith("/api/")) sendError(404, "not_found", "Unknown API route");
  else if (serveStaticFile()) return;
  else server.send(404, "text/plain", "Not found");
}

void startServer() {
  filesystemReady = LittleFS.begin(false);
  Serial.println(filesystemReady ? "LittleFS mounted" : "LittleFS unavailable; API remains active");
  server.on("/", HTTP_GET, handleRoot);
  server.on("/api/gas", HTTP_POST, handlePost);
  server.on("/api/imu", HTTP_POST, handlePost);
  server.on("/api/encoders", HTTP_POST, handlePost);
  server.on("/api/data", HTTP_GET, handleData);
  server.on("/api/status", HTTP_GET, [] { sendJson(200, nodeMonitorStatusJson()); });
  server.on("/api/alerts", HTTP_GET, [] { sendJson(200, alertManagerJson()); });
  server.on("/api/config", HTTP_GET, handleConfig);
  server.onNotFound(handleNotFound);
  server.begin();
  started = true;
  Serial.printf("HTTP API listening on port %u\n", CENTRAL_HTTP_PORT);
}
}

void httpServerBegin() { startServer(); }

void httpServerLoop() {
  if (!started) startServer();
  server.handleClient();
}
