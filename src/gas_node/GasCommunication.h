#pragma once

#include <Arduino.h>
#include "MQ2Sensor.h"

void gasCommunicationBegin();
void gasCommunicationSubmit(const GasReading& reading, const char* sensorStatus);
void gasCommunicationSubmitError(const char* sensorStatus);
