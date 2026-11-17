# Sensor setup and calibration notes

## MQ-2

The Stage 3 node reports averaged ADC counts, measured ADC-pin millivolts
scaled by the configured divider ratio, a configurable risk threshold and
warm-up state. The sensor heater requires a
suitable supply and warm-up; follow the exact module/datasheet guidance.
Confirm the module analog output range and use safe input conditioning before
connecting to the ESP32. ADC-to-voltage calculation depends on board ADC
characteristics, attenuation and divider ratio; measure/validate it. Do not
label readings as ppm without a documented calibration using an appropriate
reference gas, load resistance, sensor curve and environmental compensation.
This prototype is not a certified safety alarm.

The current `MQ2_ADC_PIN` is `-1`, and the divider ratio, warm-up duration, and
alarm/reset thresholds are provisional. Set the ADC pin and measured divider
ratio in `src/gas_node/GasConfig.h`, then set matching central alarm thresholds
in `include/project_config.h`. An ADC value alone cannot prove that an analog
sensor module is connected; inspect wiring and validate behavior during
commissioning.

## IMU

Select the model and ranges before implementation. Calibrate accelerometer
offsets and gyro bias with the robot stationary; verify axes and orientation
against known poses. A complementary filter can combine gravity-based roll and
pitch with gyro integration. Acceleration during motion affects gravity-based
tilt estimates. A basic six-axis IMU cannot provide stable absolute yaw because
gyro bias accumulates without an external reference such as a magnetometer.

## Encoders and odometry

Measure wheel diameter and wheel separation on the assembled robot. Determine
the encoder's documented pulse/count convention and whether counts are before
or after gearbox ratio. Verify pulses per wheel revolution by rotating the
wheel a known number of turns. Account for quadrature edge mode if applicable.
Single-channel encoders cannot establish direction from pulse timing alone.
Validate RPM and distance over a measured course; wheel slip and tire
deformation remain sources of error.

## Values that must be measured or confirmed

ADC scaling/divider ratio, alarm and reset levels, warm-up duration, IMU ranges
and biases, encoder type/count definition, gear ratio, wheel diameter, and
wheelbase are all deployment-specific and intentionally unset.
