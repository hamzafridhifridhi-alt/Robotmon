#pragma once

#include <Arduino.h>
#include "GasConfig.h"

struct GasReading {
  uint16_t adcRaw;
  float voltageV;
  bool warmupComplete;
  bool alarmActive;
  const char* riskLevel;
};

class MQ2Sensor {
 public:
  bool begin();
  bool sample(uint32_t nowMs, GasReading& reading);
  bool available() const;

 private:
  uint16_t rawWindow_[GAS_AVERAGING_WINDOW]{};
  uint16_t milliVoltWindow_[GAS_AVERAGING_WINDOW]{};
  size_t windowCount_ = 0;
  size_t nextIndex_ = 0;
  uint32_t warmupStartedMs_ = 0;
  bool initialized_ = false;
  bool alarmActive_ = false;
};
