export interface NodeSnapshot<T> {
  sensor_status: string;
  node_uptime_ms: number | null;
  last_seen_age_ms: number | null;
  data: T | null;
}

export interface GasMeasurements {
  adc_raw: number;
  voltage_v: number;
  warmup_complete: boolean | null;
  risk_level?: string;
  alarm_active: boolean;
}

export interface ImuMeasurements {
  ax_mps2: number;
  ay_mps2: number;
  az_mps2: number;
  gx_dps: number | null;
  gy_dps: number | null;
  gz_dps: number | null;
  roll_deg: number;
  pitch_deg: number;
}

export interface EncoderMeasurements {
  left_rpm: number;
  right_rpm: number;
  left_distance_m: number;
  right_distance_m: number;
  distance_m: number;
  linear_speed_mps: number;
  heading_change_rad: number | null;
}

export interface DataResponse {
  schema_version: string;
  server_uptime_ms: number;
  nodes: {
    gas_node: NodeSnapshot<GasMeasurements>;
    imu_node: NodeSnapshot<ImuMeasurements>;
    encoder_node: NodeSnapshot<EncoderMeasurements>;
  };
}

export interface NodeStatus {
  online: boolean;
  last_seen_age_ms: number | null;
  sensor_status: string;
}

export interface StatusResponse {
  schema_version: string;
  system_status: "online" | "degraded" | "offline";
  connected_nodes: number;
  expected_nodes: number;
  wifi_connected: boolean;
  server_ip: string | null;
  nodes: Record<string, NodeStatus>;
}

export interface AlertRecord {
  id: number;
  type: string;
  source: string;
  status: "active" | "cleared";
  value: number;
  threshold: number;
  unit: string;
  occurred_uptime_ms: number;
  email_status: "not_configured" | "queued" | "sent" | "failed";
}

export interface AlertsResponse {
  schema_version: string;
  alerts: AlertRecord[];
}

export interface ConfigResponse {
  schema_version: string;
  thresholds: {
    gas_alarm_adc: number;
    gas_alarm_reset_adc: number;
    imu_max_inclination_deg: number;
    imu_max_acceleration_mps2: number;
  };
  node_offline_timeout_ms: number;
  alert_cooldown_ms: number;
  read_only: boolean;
}

export async function getJson<T>(path: string, timeoutMs = 2500): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(path, {
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(`GET ${path} returned ${response.status}${detail ? `: ${detail}` : ""}`);
    }
    return (await response.json()) as T;
  } finally {
    window.clearTimeout(timeout);
  }
}
