#pragma once

#include <Arduino.h>
#include "SensorDataManager.h"

void alertManagerBegin();
void alertManagerEvaluate(SensorNode node);
void alertManagerNodeState(const char* nodeId, bool online, bool recovered);
String alertManagerJson();
