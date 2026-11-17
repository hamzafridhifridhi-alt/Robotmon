#include "MQ2Sensor.h"
#include "GasConfig.h"

bool MQ2Sensor::begin() {
  initialized_ = false;
  if (MQ2_ADC_PIN < 0) return false;
  analogReadResolution(12);
  analogSetPinAttenuation(MQ2_ADC_PIN, MQ2_ADC_ATTENUATION);
  warmupStartedMs_ = millis();
  windowCount_ = 0;
  nextIndex_ = 0;
  alarmActive_ = false;
  initialized_ = true;
  return true;
}

bool MQ2Sensor::available() const { return initialized_; }

bool MQ2Sensor::sample(uint32_t nowMs, GasReading& reading) {
  if (!initialized_) return false;

  rawWindow_[nextIndex_] = static_cast<uint16_t>(analogRead(MQ2_ADC_PIN));
  milliVoltWindow_[nextIndex_] = static_cast<uint16_t>(analogReadMilliVolts(MQ2_ADC_PIN));
  nextIndex_ = (nextIndex_ + 1) % GAS_AVERAGING_WINDOW;
  if (windowCount_ < GAS_AVERAGING_WINDOW) ++windowCount_;

  uint32_t rawTotal = 0;
  uint32_t milliVoltTotal = 0;
  for (size_t i = 0; i < windowCount_; ++i) {
    rawTotal += rawWindow_[i];
    milliVoltTotal += milliVoltWindow_[i];
  }
  const uint16_t averageRaw = static_cast<uint16_t>(rawTotal / windowCount_);
  const float adcVoltageV = static_cast<float>(milliVoltTotal) / (1000.0f * windowCount_);
  const bool warmed = static_cast<uint32_t>(nowMs - warmupStartedMs_) >= GAS_WARMUP_DURATION_MS;

  if (!warmed || averageRaw <= GAS_ALARM_RESET_ADC) alarmActive_ = false;
  else if (averageRaw >= GAS_ALARM_THRESHOLD_ADC) alarmActive_ = true;

  reading.adcRaw = averageRaw;
  reading.voltageV = adcVoltageV * MQ2_DIVIDER_RATIO;
  reading.warmupComplete = warmed;
  reading.alarmActive = alarmActive_;
  reading.riskLevel = !warmed ? "unknown" : alarmActive_ ? "warning" : "normal";
  return true;
}
