import type { AlertsResponse, ConfigResponse, DataResponse, StatusResponse } from "./api/types";

export interface SimulationFrame {
  simulation: true;
  data: DataResponse;
  status: StatusResponse;
  alerts: AlertsResponse;
  config: ConfigResponse;
}

// Synthetic values are isolated here and used only with ?mode=simulation.
export function createSimulationFrame(tick: number): SimulationFrame {
  const drift = Math.sin(tick / 7);
  return {
    simulation: true,
    data: {
      schema_version: "1.0",
      server_uptime_ms: tick * 1000,
      nodes: {
        gas_node: {
          sensor_status: "ok", node_uptime_ms: tick * 1000, last_seen_age_ms: 350,
          data: { adc_raw: 820 + Math.round(12 * drift), voltage_v: 0.66, warmup_complete: true, risk_level: "normal", alarm_active: false },
        },
        imu_node: {
          sensor_status: "ok", node_uptime_ms: tick * 1000, last_seen_age_ms: 410,
          data: { ax_mps2: 0.04, ay_mps2: -0.07, az_mps2: 9.79, gx_dps: 0.12, gy_dps: -0.08, gz_dps: 0.03, roll_deg: -1.8 + drift, pitch_deg: 2.1 },
        },
        encoder_node: {
          sensor_status: "ok", node_uptime_ms: tick * 1000, last_seen_age_ms: 300,
          data: { left_rpm: 42.6, right_rpm: 43.1, left_distance_m: 18.36 + tick / 10000, right_distance_m: 18.48 + tick / 10000, distance_m: 18.42 + tick / 10000, linear_speed_mps: 0.31, heading_change_rad: 0.021 },
        },
      },
    },
    status: {
      schema_version: "1.0", system_status: "online", connected_nodes: 3, expected_nodes: 3,
      wifi_connected: true, server_ip: "simulation", nodes: {
        gas_node: { online: true, last_seen_age_ms: 350, sensor_status: "ok" },
        imu_node: { online: true, last_seen_age_ms: 410, sensor_status: "ok" },
        encoder_node: { online: true, last_seen_age_ms: 300, sensor_status: "ok" },
      },
    },
    alerts: { schema_version: "1.0", alerts: [] },
    config: {
      schema_version: "1.0", thresholds: { gas_alarm_adc: 1600, gas_alarm_reset_adc: 1450, imu_max_inclination_deg: 35, imu_max_acceleration_mps2: 25 },
      node_offline_timeout_ms: 10000, alert_cooldown_ms: 60000, read_only: true,
    },
  };
}
