#include <Arduino.h>
#include "GasConfig.h"
#include "MQ2Sensor.h"
#include "GasCommunication.h"

namespace {
MQ2Sensor sensor;
uint32_t lastSampleMs = 0;
uint32_t lastTransmitMs = 0;
uint32_t lastErrorTransmitMs = 0;
GasReading latestReading{};
bool hasReading = false;
}

void setup() {
  Serial.begin(115200);
  Serial.println("Robot Monitoring System - gas node");
  gasCommunicationBegin();
  if (!sensor.begin()) {
    Serial.println("MQ-2 ADC pin is not configured; set MQ2_ADC_PIN after wiring is confirmed");
  }
}

void loop() {
  const uint32_t now = millis();
  if (static_cast<uint32_t>(now - lastSampleMs) >= GAS_SAMPLE_INTERVAL_MS) {
    lastSampleMs = now;
    hasReading = sensor.sample(now, latestReading);
  }

  if (hasReading && static_cast<uint32_t>(now - lastTransmitMs) >= GAS_TRANSMIT_INTERVAL_MS) {
    lastTransmitMs = now;
    Serial.printf("MQ-2 ADC=%u voltage=%.3f V warm=%s alarm=%s\n",
                  latestReading.adcRaw, latestReading.voltageV,
                  latestReading.warmupComplete ? "yes" : "no",
                  latestReading.alarmActive ? "yes" : "no");
    gasCommunicationSubmit(latestReading,
                           latestReading.warmupComplete ? "ok" : "warming_up");
  } else if (!sensor.available() && static_cast<uint32_t>(now - lastErrorTransmitMs) >= GAS_TRANSMIT_INTERVAL_MS) {
    lastErrorTransmitMs = now;
    gasCommunicationSubmitError("error");
  }
  delay(1);
}
