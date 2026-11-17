# Wiring and hardware confirmation

No pin assignments are finalized because exact board revisions and sensor
modules are not yet known. Confirm each board's pinout before wiring.

## Topology

```text
MQ-2 module analog output -> verified conditioning -> gas ESP32 ADC
IMU SDA/SCL               -> confirmed I2C pins on IMU ESP32
Left encoder output       -> confirmed interrupt-capable input
Right encoder output      -> confirmed interrupt-capable input
All nodes                 -> common Wi-Fi router (no inter-board signal wire)
```

## Required checks before wiring

- Identify exact ESP32 development board and ESP32-S3 module/board revisions.
- Confirm logic voltage, ADC limits/attenuation, available ADC-capable pins,
  strapping pins, USB/UART conflicts, and pinout for each board.
- Identify MQ-2 breakout/module, supply current, output circuit, and maximum
  analog output. Never connect a possible 5 V analog output directly to an ESP32
  input; design and verify voltage conditioning first. Share ground as required.
- Set `MQ2_ADC_PIN` only after confirming the board pinout and analog
  conditioning. Stage 3 sets it to `-1` (unconfigured), so firmware reports
  sensor error and does not attempt ADC reads.
- Identify IMU model, supply/logic voltage, I2C address, and required pull-ups.
- Identify encoder output type (single channel or quadrature), voltage, counts
  per revolution definition, and whether motor gearing is included.
- Confirm power budget, motor noise/grounding, cable lengths, and mounting.

Create a board-specific pin table and schematic only after these facts are
provided. Do not use this conceptual topology as a wiring schematic.
