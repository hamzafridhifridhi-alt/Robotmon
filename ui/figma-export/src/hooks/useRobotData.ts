import { useEffect, useState } from "react";
import {
  getJson,
  type AlertsResponse,
  type ConfigResponse,
  type DataResponse,
  type StatusResponse,
} from "../api/types";
import { createSimulationFrame } from "../simulation";

export interface TelemetryHistory {
  gas: number[];
  speed: number[];
  roll: number[];
  pitch: number[];
  accelX: number[];
  accelY: number[];
  distance: number[];
}

export interface RobotDataState {
  data: DataResponse | null;
  status: StatusResponse | null;
  alerts: AlertsResponse | null;
  config: ConfigResponse | null;
  history: TelemetryHistory;
  connected: boolean;
  loading: boolean;
  error: string | null;
  lastResponseAt: number | null;
  simulation: boolean;
}

const emptyHistory: TelemetryHistory = {
  gas: [], speed: [], roll: [], pitch: [], accelX: [], accelY: [], distance: [],
};

function appendHistory(
  previous: TelemetryHistory,
  data: DataResponse,
  previousData: DataResponse | null,
): TelemetryHistory {
  const gas = data.nodes.gas_node.data;
  const imu = data.nodes.imu_node.data;
  const encoder = data.nodes.encoder_node.data;
  const isNewSample = (node: keyof DataResponse["nodes"]) => {
    const nodeUptime = data.nodes[node].node_uptime_ms;
    const previousNodeUptime = previousData?.nodes[node].node_uptime_ms;
    return nodeUptime != null && (previousNodeUptime == null || nodeUptime !== previousNodeUptime);
  };
  const append = (values: number[], next: number | null | undefined, fresh: boolean) =>
    next == null || !fresh ? values : [...values, next].slice(-60);
  return {
    gas: append(previous.gas, gas?.adc_raw, isNewSample("gas_node")),
    speed: append(previous.speed, encoder?.linear_speed_mps, isNewSample("encoder_node")),
    roll: append(previous.roll, imu?.roll_deg, isNewSample("imu_node")),
    pitch: append(previous.pitch, imu?.pitch_deg, isNewSample("imu_node")),
    accelX: append(previous.accelX, imu?.ax_mps2, isNewSample("imu_node")),
    accelY: append(previous.accelY, imu?.ay_mps2, isNewSample("imu_node")),
    distance: append(previous.distance, encoder?.distance_m, isNewSample("encoder_node")),
  };
}

export function useRobotData(): RobotDataState {
  const simulation = import.meta.env.DEV && new URLSearchParams(window.location.search).get("mode") === "simulation";
  const [state, setState] = useState<RobotDataState>({
    data: null,
    status: null,
    alerts: null,
    config: null,
    history: emptyHistory,
    connected: false,
    loading: true,
    error: null,
    lastResponseAt: null,
    simulation,
  });

  useEffect(() => {
    let active = true;
    let timer = 0;
    let tick = 0;
    let lastSlowPoll = 0;

    const run = async () => {
      if (!active) return;
      tick += 1;

      if (simulation) {
        const frame = createSimulationFrame(tick);
        if (active) {
          setState((previous) => ({
            ...previous,
            ...frame,
            history: appendHistory(previous.history, frame.data, null),
            connected: true,
            loading: false,
            error: null,
            lastResponseAt: Date.now(),
          }));
        }
      } else {
        const [dataResult, statusResult] = await Promise.allSettled([
          getJson<DataResponse>("/api/data"),
          getJson<StatusResponse>("/api/status"),
        ]);
        const pollSlowEndpoints = tick === 1 || Date.now() - lastSlowPoll >= 5000;
        const [alertsResult, configResult] = pollSlowEndpoints
          ? await Promise.allSettled([
              getJson<AlertsResponse>("/api/alerts"),
              getJson<ConfigResponse>("/api/config"),
            ])
          : [null, null];
        if (pollSlowEndpoints) lastSlowPoll = Date.now();

        if (active) {
          setState((previous) => {
            const nextData = dataResult.status === "fulfilled" ? dataResult.value : previous.data;
            const nextStatus = statusResult.status === "fulfilled" ? statusResult.value : previous.status;
            const failures: string[] = [];
            if (dataResult.status === "rejected") failures.push("data");
            if (statusResult.status === "rejected") failures.push("status");
            return {
              ...previous,
              data: nextData,
              status: statusResult.status === "fulfilled" ? nextStatus : null,
              alerts: alertsResult?.status === "fulfilled" ? alertsResult.value : previous.alerts,
              config: configResult?.status === "fulfilled" ? configResult.value : previous.config,
              history: dataResult.status === "fulfilled" ? appendHistory(previous.history, dataResult.value, previous.data) : previous.history,
              connected: statusResult.status === "fulfilled",
              loading: false,
              error: failures.length === 2 ? "Cannot reach the ESP32-S3 API" : failures.length ? `Unable to refresh ${failures.join(" and ")}` : null,
              lastResponseAt: dataResult.status === "fulfilled" || statusResult.status === "fulfilled" ? Date.now() : previous.lastResponseAt,
            };
          });
        }
      }
      if (active) timer = window.setTimeout(run, 1000);
    };

    void run();
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [simulation]);

  return state;
}
