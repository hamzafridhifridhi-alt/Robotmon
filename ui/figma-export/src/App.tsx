import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRobotData, type TelemetryHistory } from "./hooks/useRobotData";
import type { AlertRecord, DataResponse, StatusResponse } from "./api/types";

type Page =
  | "Overview"
  | "Gas Monitoring"
  | "Inertial Monitoring"
  | "Odometry"
  | "Alert History"
  | "Settings";
type Severity = "INFO" | "WARNING" | "CRITICAL";
type IconName =
  | "grid"
  | "gas"
  | "activity"
  | "route"
  | "bell"
  | "settings"
  | "wifi"
  | "mail"
  | "chevron"
  | "menu"
  | "x";

const navItems: { name: Page; icon: IconName }[] = [
  { name: "Overview", icon: "grid" },
  { name: "Gas Monitoring", icon: "gas" },
  { name: "Inertial Monitoring", icon: "activity" },
  { name: "Odometry", icon: "route" },
  { name: "Alert History", icon: "bell" },
  { name: "Settings", icon: "settings" },
];

type UiEvent = {
  time: string;
  source: string;
  event: string;
  severity: Severity;
  status: string;
};

function numberText(value: number | null | undefined, digits = 2, signed = false): string {
  if (value == null || !Number.isFinite(value)) return "N/A";
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}`;
}

function nodeTone(online: boolean | undefined, sensorStatus?: string): "success" | "warning" | "critical" | "neutral" {
  if (online === undefined) return "neutral";
  if (!online || sensorStatus === "error" || sensorStatus === "disconnected") return "critical";
  if (sensorStatus && sensorStatus !== "ok") return "warning";
  return "success";
}

function statusLabel(online: boolean | undefined, sensorStatus?: string): string {
  if (online === undefined) return "Waiting for API";
  if (!online) return "Disconnected";
  return sensorStatus === "ok" ? "Online" : sensorStatus || "Unknown";
}

function makeEventRows(alerts: AlertRecord[] | undefined): UiEvent[] {
  const typeText: Record<string, string> = {
    gas_threshold: "Gas reading exceeded the configured alarm threshold",
    imu_inclination: "Robot inclination exceeded the configured limit",
    imu_acceleration: "Acceleration exceeded the configured limit",
    node_offline: "Sensor node stopped communicating",
    node_recovered: "Sensor node communication recovered",
  };
  return (alerts ?? []).map((alert) => {
    const source = alert.source === "gas_node" ? "MQ-2" : alert.source === "imu_node" ? "IMU" : alert.source === "encoder_node" ? "ODOMETRY" : alert.source.toUpperCase();
    const severity: Severity = alert.type === "node_offline" ? "CRITICAL" : alert.type === "node_recovered" ? "INFO" : "WARNING";
    return {
      time: `+${(alert.occurred_uptime_ms / 1000).toFixed(1)} s`,
      source,
      event: typeText[alert.type] ?? alert.type.replace(/_/g, " "),
      severity,
      status: (alert.status === "active" ? "Active" : "Cleared") + " · Email " + alert.email_status.replace(/_/g, " "),
    };
  }).reverse();
}

function latestAge(status: StatusResponse | null): number | null {
  const ages = Object.values(status?.nodes ?? {})
    .map((node) => node.last_seen_age_ms)
    .filter((age): age is number => age != null);
  return ages.length ? Math.min(...ages) : null;
}

function ageText(ageMs: number | null): string {
  if (ageMs == null) return "No node data";
  return ageMs < 1000 ? `${ageMs} ms ago` : `${(ageMs / 1000).toFixed(1)} s ago`;
}

function Icon({ name, size = 17 }: { name: IconName; size?: number }) {
  const paths: Record<IconName, ReactNode> = {
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
      </>
    ),
    gas: (
      <>
        <path d="M12 22c4.4 0 8-3.3 8-7.4C20 9 12 2 12 2S4 9 4 14.6C4 18.7 7.6 22 12 22Z" />
        <path d="M8.5 16.5c1.8.8 4.6.8 7 0" />
      </>
    ),
    activity: <path d="M3 12h4l2.5-7 5 14 2.5-7h4" />,
    route: (
      <>
        <circle cx="6" cy="19" r="2" />
        <circle cx="18" cy="5" r="2" />
        <path d="M8 19h2a3 3 0 0 0 3-3V8a3 3 0 0 1 3-3" />
      </>
    ),
    bell: (
      <>
        <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
        <path d="M10 21h4" />
      </>
    ),
    settings: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1a1.7 1.7 0 0 0 1.9.3A1.7 1.7 0 0 0 10 3V2.8h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z" />
      </>
    ),
    wifi: (
      <>
        <path d="M5 12.6a10 10 0 0 1 14 0" />
        <path d="M8.5 16a5 5 0 0 1 7 0" />
        <path d="M2 9a15 15 0 0 1 20 0" />
        <circle cx="12" cy="20" r=".7" fill="currentColor" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="1" />
        <path d="m3 7 9 6 9-6" />
      </>
    ),
    chevron: <path d="m9 18 6-6-6-6" />,
    menu: (
      <>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </>
    ),
    x: <path d="m6 6 12 12M18 6 6 18" />,
  };
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

function StatusDot({
  tone = "success",
  label,
}: {
  tone?: "success" | "warning" | "critical" | "neutral";
  label: string;
}) {
  return (
    <span className={`status-dot ${tone}`}>
      <i />
      {label}
    </span>
  );
}

function Panel({
  title,
  eyebrow,
  action,
  children,
  className = "",
}: {
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <header className="panel-header">
          <div>
            {eyebrow && <span className="eyebrow">{eyebrow}</span>}
            <h3>{title}</h3>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

function Metric({
  label,
  value,
  unit,
  sub,
  tone,
}: {
  label: string;
  value: string;
  unit?: string;
  sub?: string;
  tone?: string;
}) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <div className={`metric-value ${tone || ""}`}>
        {value}
        {unit && <small>{unit}</small>}
      </div>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

function Chart({ lines, history, height = 112, labels = true }: { lines: (keyof TelemetryHistory)[]; history: TelemetryHistory; height?: number; labels?: boolean }) {
  const colors = ["#2563EB", "#D99520", "#16845B"];
  const values = lines.map((line) => history[line]);
  const allValues = values.flat();
  const min = allValues.length ? Math.min(...allValues) : 0;
  const max = allValues.length ? Math.max(...allValues) : 1;
  const range = Math.max(max - min, 0.001);
  return (
    <div className="chart" style={{ height }}>
      <svg viewBox="0 0 324 76" preserveAspectRatio="none">
        {[15, 35, 55, 75].map((y) => <line key={y} x1="0" y1={y} x2="324" y2={y} className="grid-line" />)}
        {values.map((series, i) => series.length > 1 && (
          <polyline key={lines[i]} points={series.map((value, index) => {
            const x = (index / Math.max(series.length - 1, 1)) * 324;
            const y = 68 - ((value - min) / range) * 58;
            return `${x.toFixed(1)},${y.toFixed(1)}`;
          }).join(" ")} fill="none" stroke={colors[i % colors.length]} strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        ))}
      </svg>
      {!allValues.length && <span className="chart-empty">Waiting for sensor samples</span>}
      {labels && <div className="chart-labels"><span>Older</span><span>Recent</span><span>Now</span></div>}
    </div>
  );
}

function TiltIndicator({ large = false, roll = null, pitch = null }: { large?: boolean; roll?: number | null; pitch?: number | null }) {
  return (
    <div className={`tilt ${large ? "large" : ""}`}>
      <div className="tilt-axis x" /><div className="tilt-axis y" />
      <div className="tilt-ring r1" /><div className="tilt-ring r2" />
      <div className="tilt-plane" style={{ transform: `rotate(${roll ?? 0}deg)`, opacity: roll == null ? 0.3 : 1 }}><span /></div>
      <div className="tilt-center" />
      <span className="tilt-label top">P {numberText(pitch, 1, true)}{"\u00B0"}</span>
      <span className="tilt-label side">R {numberText(roll, 1, true)}{"\u00B0"}</span>
    </div>
  );
}

function EventTable({ rows }: { rows: UiEvent[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Source</th>
            <th>Event</th>
            <th>Severity</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((event, i) => (
            <tr key={`${event.time}-${i}`}>
              <td className="mono">{event.time}</td>
              <td className="source">{event.source}</td>
              <td>{event.event}</td>
              <td>
                <span className={`severity ${event.severity.toLowerCase()}`}>{event.severity}</span>
              </td>
              <td>
                <span className="row-status">
                  <i />
                  {event.status}
                </span>
              </td>
            </tr>
          ))}
          {!rows.length && <tr><td colSpan={5} className="empty-row">No alert records available</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function PageIntro({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: ReactNode;
}) {
  return (
    <div className="page-intro">
      <div>
        <h1>{title}</h1>
        <p>{subtitle}</p>
      </div>
      {right}
    </div>
  );
}

function Overview({ data, status, alerts, history, simulation, lastResponseAt, onViewAlerts }: {
  data: DataResponse | null; status: StatusResponse | null; alerts: AlertRecord[]; history: TelemetryHistory;
  simulation: boolean; lastResponseAt: number | null; onViewAlerts: () => void;
}) {
  const gas = data?.nodes.gas_node.data;
  const imu = data?.nodes.imu_node.data;
  const enc = data?.nodes.encoder_node.data;
  const rows = makeEventRows(alerts).slice(0, 6);
  const smtpConfigured = alerts.some((alert) => alert.email_status !== "not_configured");
  const system = status?.system_status?.toUpperCase() ?? "NO CONNECTION";
  const age = latestAge(status);
  return (
    <>
      <PageIntro title="Robot Monitoring System" subtitle="Real-time environmental and motion monitoring" right={<div className="mode-note"><span>{simulation ? "SIMULATION" : status ? "LIVE API" : "API OFFLINE"}</span> {simulation ? "Synthetic data" : "ESP32-S3 telemetry"}</div>} />
      <div className="status-strip">
        <div className="status-primary"><span>Overall status</span><strong className={system.toLowerCase().replace(" ", "-")}><i />{system}</strong></div>
        <div><span>Connected nodes</span><strong>{status ? status.connected_nodes + " / " + status.expected_nodes : "N/A / 3"}</strong></div>
        <div><span>Last data update</span><strong className="mono">{ageText(age)}</strong></div>
        <div><span>Wi-Fi</span><StatusDot tone={status?.wifi_connected ? "success" : status ? "critical" : "neutral"} label={status?.wifi_connected ? "Connected" : status ? "Disconnected" : "Unknown"} /></div>
        <div><span>SMTP service</span><StatusDot tone={smtpConfigured ? "success" : "neutral"} label={smtpConfigured ? "Configured" : "Not configured"} /></div>
      </div>
      <div className="overview-grid">
        <Panel title="Gas monitoring" eyebrow="MQ-2 / ENVIRONMENT" action={<StatusDot tone={nodeTone(status?.nodes.gas_node?.online, data?.nodes.gas_node.sensor_status)} label={statusLabel(status?.nodes.gas_node?.online, data?.nodes.gas_node.sensor_status)} />}>
          <div className="metrics two"><Metric label="Gas sensor reading" value={gas ? String(gas.adc_raw) : "\u2014"} unit="ADC" sub="Relative indication" /><Metric label="ADC voltage" value={gas ? numberText(gas.voltage_v, 2) : "N/A"} unit="V" sub="Conditioned input" /></div>
          <div className="threshold-row"><span>Risk state <b>{gas?.risk_level ?? "Unavailable"}</b></span><span>Warm-up <b>{gas?.warmup_complete == null ? "Unknown" : gas.warmup_complete ? "Complete" : "In progress"}</b></span></div>
          <Chart lines={["gas"]} history={history} height={102} />
        </Panel>
        <Panel title="Inertial monitoring" eyebrow="IMU / MOTION" action={<StatusDot tone={nodeTone(status?.nodes.imu_node?.online, data?.nodes.imu_node.sensor_status)} label={statusLabel(status?.nodes.imu_node?.online, data?.nodes.imu_node.sensor_status)} />}>
          <div className="imu-layout"><TiltIndicator roll={imu?.roll_deg} pitch={imu?.pitch_deg} /><div className="metrics two compact">
            <Metric label="Roll" value={numberText(imu?.roll_deg, 1, true)} unit={"\u00B0"} /><Metric label="Pitch" value={numberText(imu?.pitch_deg, 1, true)} unit={"\u00B0"} />
            <Metric label="Accel X" value={numberText(imu?.ax_mps2)} unit="m/s\u00B2" /><Metric label="Accel Y" value={numberText(imu?.ay_mps2)} unit="m/s\u00B2" /><Metric label="Accel Z" value={numberText(imu?.az_mps2)} unit="m/s\u00B2" />
          </div></div>
        </Panel>
        <Panel title="Odometry" eyebrow="DUAL ENCODER / DRIVE" action={<StatusDot tone={nodeTone(status?.nodes.encoder_node?.online, data?.nodes.encoder_node.sensor_status)} label={statusLabel(status?.nodes.encoder_node?.online, data?.nodes.encoder_node.sensor_status)} />}>
          <div className="metrics four"><Metric label="Left wheel" value={numberText(enc?.left_rpm, 1)} unit="RPM" /><Metric label="Right wheel" value={numberText(enc?.right_rpm, 1)} unit="RPM" /><Metric label="Total distance" value={numberText(enc?.distance_m, 2)} unit="m" /><Metric label="Linear speed" value={numberText(enc?.linear_speed_mps, 2)} unit="m/s" /></div>
          <Chart lines={["speed"]} history={history} height={105} />
        </Panel>
      </div>
      <Panel title="Recent events" eyebrow="SYSTEM LOG" action={<button className="text-button" onClick={onViewAlerts}>View all <Icon name="chevron" size={14} /></button>}><EventTable rows={rows} /></Panel>
      {lastResponseAt == null && !simulation && <p className="api-error">Waiting for live data from the central ESP32-S3.</p>}
    </>
  );
}

function GasPage({ settings, data, status, history }: { settings: SettingsState; data: DataResponse | null; status: StatusResponse | null; history: TelemetryHistory }) {
  const gas = data?.nodes.gas_node.data;
  const node = status?.nodes.gas_node;
  const threshold = Number(settings.gasCritical);
  const progress = gas && Number.isFinite(threshold) && threshold > 0 ? Math.min(100, Math.max(0, gas.adc_raw / threshold * 100)) : 0;
  return (
    <>
      <PageIntro title="Gas Monitoring" subtitle="MQ-2 combustible gas and smoke sensor" right={<StatusDot tone={nodeTone(node?.online, data?.nodes.gas_node.sensor_status)} label={statusLabel(node?.online, data?.nodes.gas_node.sensor_status)} />} />
      <div className="info-banner"><strong>Relative indication only</strong><span>The MQ-2 is not calibrated for an accurate ppm measurement. Values shown are raw ADC and relative gas indications.</span></div>
      <div className="metrics-grid six">
        <Metric label="Current ADC value" value={gas ? String(gas.adc_raw) : "N/A"} unit="/ 4095" sub={node ? ageText(node.last_seen_age_ms) : "No live reading"} />
        <Metric label="Analog voltage" value={gas ? numberText(gas.voltage_v, 2) : "N/A"} unit="V" sub="At conditioned ADC input" />
        <Metric label="Alarm reset level" value={settings.gasWarning} unit="ADC" sub="From API configuration" />
        <Metric label="Alarm threshold" value={settings.gasCritical} unit="ADC" sub="From API configuration" />
        <Metric label="Sensor warm-up" value={gas?.warmup_complete == null ? "?" : gas.warmup_complete ? "Complete" : "Warming"} sub={gas?.warmup_complete == null ? "Unavailable" : "MQ-2 heater"} tone={gas?.warmup_complete ? "success-text" : undefined} />
        <Metric label="Calibration state" value="Uncalibrated" sub="Relative indicator only" />
      </div>
      <Panel title="Historical gas sensor reading" eyebrow="RECENT LIVE SAMPLES" action={<div className="legend"><i /> ADC reading</div>}><div className="plot-shell"><div className="y-labels"><span>High</span><span>?</span><span>?</span><span>Low</span></div><Chart lines={["gas"]} history={history} height={250} /></div></Panel>
      <div className="two-col">
        <Panel title="Threshold status" eyebrow="ALARM LOGIC"><div className="progress-label"><span>Current relative indication</span><strong>{gas ? gas.adc_raw + " / " + (settings.gasCritical || "?") + " ADC" : "No live reading"}</strong></div><div className="progress"><i style={{ width: progress + "%" }} /></div><div className="threshold-scale"><span>0</span><span className="warn">Reset {settings.gasWarning}</span><span className="crit">Alarm {settings.gasCritical}</span></div></Panel>
        <Panel title="Sensor diagnostics" eyebrow="MQ-2 MODULE"><dl className="diagnostic-list"><div><dt>Node ID</dt><dd>gas_node</dd></div><div><dt>Last communication</dt><dd>{node ? ageText(node.last_seen_age_ms) : "No data"}</dd></div><div><dt>Risk state</dt><dd>{gas?.risk_level ?? "Unavailable"}</dd></div><div><dt>Calibration</dt><dd>Not calibrated</dd></div></dl></Panel>
      </div>
    </>
  );
}

function InertialPage({ data, status, history }: { data: DataResponse | null; status: StatusResponse | null; history: TelemetryHistory }) {
  const imu = data?.nodes.imu_node.data;
  const node = status?.nodes.imu_node;
  return (
    <>
      <PageIntro title="Inertial Monitoring" subtitle="Robot orientation, acceleration and angular velocity" right={<StatusDot tone={nodeTone(node?.online, data?.nodes.imu_node.sensor_status)} label={statusLabel(node?.online, data?.nodes.imu_node.sensor_status)} />} />
      <div className="imu-page-grid"><Panel title="Inclination" eyebrow="2-AXIS ATTITUDE"><TiltIndicator large roll={imu?.roll_deg} pitch={imu?.pitch_deg} /><div className="tilt-readouts"><Metric label="Roll angle" value={numberText(imu?.roll_deg, 1, true)} unit={"\u00B0"} /><Metric label="Pitch angle" value={numberText(imu?.pitch_deg, 1, true)} unit={"\u00B0"} /></div></Panel>
        <div className="sensor-stack"><Panel title="Linear acceleration" eyebrow={"m/s\u00B2"}><div className="metrics three"><Metric label="X axis" value={numberText(imu?.ax_mps2, 2, true)} unit={"m/s\u00B2"} /><Metric label="Y axis" value={numberText(imu?.ay_mps2, 2, true)} unit={"m/s\u00B2"} /><Metric label="Z axis" value={numberText(imu?.az_mps2, 2, true)} unit={"m/s\u00B2"} /></div></Panel>
          <Panel title="Angular velocity" eyebrow={"\u00B0/s"}><div className="metrics three"><Metric label="X axis" value={numberText(imu?.gx_dps, 2, true)} unit={"\u00B0/s"} /><Metric label="Y axis" value={numberText(imu?.gy_dps, 2, true)} unit={"\u00B0/s"} /><Metric label="Z axis" value={numberText(imu?.gz_dps, 2, true)} unit={"\u00B0/s"} /></div></Panel></div>
      </div>
      <div className="two-col"><Panel title="Roll and pitch history" eyebrow="RECENT LIVE SAMPLES" action={<div className="legend"><i /> Roll <b /> Pitch</div>}><Chart lines={["roll", "pitch"]} history={history} height={220} /></Panel><Panel title="Acceleration history" eyebrow="RECENT LIVE SAMPLES" action={<div className="legend"><i /> X <b /> Y</div>}><Chart lines={["accelX", "accelY"]} history={history} height={220} /></Panel></div>
    </>
  );
}

function RobotSchematic({ separation }: { separation: string }) {
  return <div className="robot-schematic"><div className="wheel left"><span>L</span></div><div className="robot-body"><div className="front-mark">FRONT</div><div className="board">ESP32-S3</div><i className="axis-line" /></div><div className="wheel right"><span>R</span></div><div className="dimension">WHEEL SEPARATION &#183; {separation === "N/A" ? "Not configured" : separation + " mm"}</div></div>;
}

function OdometryPage({ data, status, history, settings }: { data: DataResponse | null; status: StatusResponse | null; history: TelemetryHistory; settings: SettingsState }) {
  const enc = data?.nodes.encoder_node.data;
  const node = status?.nodes.encoder_node;
  return (
    <>
      <PageIntro title="Odometry" subtitle="Differential-drive wheel encoder monitoring" right={<StatusDot tone={nodeTone(node?.online, data?.nodes.encoder_node.sensor_status)} label={statusLabel(node?.online, data?.nodes.encoder_node.sensor_status)} />} />
      <div className="metrics-grid seven"><Metric label="Left wheel" value={numberText(enc?.left_rpm, 1)} unit="RPM" /><Metric label="Right wheel" value={numberText(enc?.right_rpm, 1)} unit="RPM" /><Metric label="Left displacement" value={numberText(enc?.left_distance_m, 2)} unit="m" /><Metric label="Right displacement" value={numberText(enc?.right_distance_m, 2)} unit="m" /><Metric label="Estimated distance" value={numberText(enc?.distance_m, 2)} unit="m" /><Metric label="Linear speed" value={numberText(enc?.linear_speed_mps, 2)} unit="m/s" /><Metric label="Heading change" value={enc?.heading_change_rad == null ? "N/A" : numberText(enc.heading_change_rad * 180 / Math.PI, 1, true)} unit={"\u00B0"} /></div>
      <div className="odometry-grid"><Panel title="Differential drive" eyebrow="TOP VIEW"><RobotSchematic separation={settings.separation} /></Panel><Panel title="Wheel displacement" eyebrow="LATEST API MEASUREMENTS"><div className="counter"><span>LEFT WHEEL</span><strong>{numberText(enc?.left_distance_m, 2)} m</strong><small>Encoder resolution is not reported by the API</small></div><div className="counter"><span>RIGHT WHEEL</span><strong>{numberText(enc?.right_distance_m, 2)} m</strong><small>Encoder resolution is not reported by the API</small></div></Panel></div>
      <div className="two-col"><Panel title="Linear speed history" eyebrow="RECENT LIVE SAMPLES"><Chart lines={["speed"]} history={history} height={210} /></Panel><Panel title="Estimated distance" eyebrow="CURRENT SESSION"><Chart lines={["distance"]} history={history} height={210} /></Panel></div>
    </>
  );
}

function AlertPage({ rows, alerts, lastSyncAt }: { rows: UiEvent[]; alerts: AlertRecord[]; lastSyncAt: number | null }) {
  const [severity, setSeverity] = useState("All severities");
  const [source, setSource] = useState("All sources");
  const filtered = rows.filter((event) => (severity === "All severities" || event.severity === severity) && (source === "All sources" || event.source === source));
  const activeCount = alerts.filter((alert) => alert.status === "active").length;
  const criticalCount = rows.filter((event) => event.severity === "CRITICAL").length;
  const sentCount = alerts.filter((alert) => alert.email_status === "sent").length;
  const exportCsv = () => {
    const csv = [["Uptime", "Source", "Event", "Severity", "Status"], ...filtered.map((event) => [event.time, event.source, event.event, event.severity, event.status])]
      .map((row) => row.map((cell) => "\"" + cell.replace(/\"/g, "\"\"") + "\"").join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a"); link.href = url; link.download = "robotmon-events.csv"; link.click(); URL.revokeObjectURL(url);
  };
  return (
    <>
      <PageIntro title="Alert History" subtitle="System events and notification delivery" right={<button className="secondary-button" onClick={exportCsv}>Export CSV</button>} />
      <Panel className="filter-panel"><div className="filters">
        <label>Date range<select disabled><option>Current boot session</option></select></label>
        <label>Source<select value={source} onChange={(e) => setSource(e.target.value)}><option>All sources</option><option>MQ-2</option><option>IMU</option><option>ODOMETRY</option><option>SYSTEM</option></select></label>
        <label>Severity<select value={severity} onChange={(e) => setSeverity(e.target.value)}><option>All severities</option><option>INFO</option><option>WARNING</option><option>CRITICAL</option></select></label>
        <button className="secondary-button reset" onClick={() => { setSeverity("All severities"); setSource("All sources"); }}>Reset filters</button>
      </div></Panel>
      <div className="alert-summary"><div><span>Records</span><strong>{alerts.length}</strong></div><div><span>Active</span><strong className="amber">{activeCount}</strong></div><div><span>Critical</span><strong className="red">{criticalCount}</strong></div><div><span>Email sent</span><strong className="green">{sentCount}</strong></div></div>
      <Panel title="Event log" eyebrow={filtered.length + " MATCHING EVENTS"} action={<span className="last-sync">{lastSyncAt ? "Last synced " + new Date(lastSyncAt).toLocaleTimeString() : "Waiting for API"}</span>}><EventTable rows={filtered} /></Panel>
    </>
  );
}

type SettingsState = {
  gasWarning: string;
  gasCritical: string;
  hysteresis: string;
  calibration: string;
  incline: string;
  acceleration: string;
  diameter: string;
  resolution: string;
  gearRatio: string;
  separation: string;
  email: string;
  cooldown: string;
  notifications: boolean | null;
};

function Field({
  label,
  value,
  unit,
  type = "text",
  onChange,
  readOnly = false,
}: {
  label: string;
  value: string;
  unit?: string;
  type?: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} readOnly={readOnly} />
        {unit && <em>{unit}</em>}
      </div>
    </label>
  );
}

function SettingsPage({ settings }: { settings: SettingsState }) {
  const unchanged = () => undefined;
  return (
    <>
      <PageIntro title="Settings" subtitle="Controller configuration reported by the REST API" right={<div className="settings-actions"><span className="save-confirm show">Read-only API</span><button className="primary-button" disabled>Settings updates unavailable</button></div>} />
      <div className="settings-grid">
        <Panel title="Gas sensor" eyebrow="MQ-2 THRESHOLDS"><div className="form-grid">
          <Field label="Alarm reset threshold" value={settings.gasWarning} unit="ADC" onChange={unchanged} readOnly />
          <Field label="Alarm threshold" value={settings.gasCritical} unit="ADC" onChange={unchanged} readOnly />
          <Field label="Calibration status" value={settings.calibration} onChange={unchanged} readOnly />
        </div></Panel>
        <Panel title="IMU limits" eyebrow="MOTION THRESHOLDS"><div className="form-grid">
          <Field label="Inclination warning" value={settings.incline} unit="degrees" onChange={unchanged} readOnly />
          <Field label="Acceleration warning" value={settings.acceleration} unit={"m/s\u00B2"} onChange={unchanged} readOnly />
        </div><p className="form-note">These thresholds are read from the controller configuration. The current API does not accept updates.</p></Panel>
        <Panel title="Encoder geometry" eyebrow="ODOMETRY PARAMETERS"><div className="form-grid">
          <Field label="Wheel diameter" value={settings.diameter} unit="mm" onChange={unchanged} readOnly />
          <Field label="Encoder resolution" value={settings.resolution} unit="PPR" onChange={unchanged} readOnly />
          <Field label="Gear ratio" value={settings.gearRatio} unit=": 1" onChange={unchanged} readOnly />
          <Field label="Wheel separation" value={settings.separation} unit="mm" onChange={unchanged} readOnly />
        </div></Panel>
        <Panel title="Notifications" eyebrow="SMTP ALERT DELIVERY"><div className="form-grid">
          <Field label="Email recipient" value={settings.email} type="text" onChange={unchanged} readOnly />
          <Field label="Alert cooldown" value={settings.cooldown} unit="seconds" onChange={unchanged} readOnly />
        </div>
          <label className="toggle-row"><span><strong>Notification state</strong><small>SMTP status is not available from the current configuration API.</small></span><input type="checkbox" checked={settings.notifications ?? false} disabled readOnly /><i /></label>
          <div className="secure-note"><Icon name="mail" size={16} /><span>SMTP credentials and recipient configuration are not returned to the browser.</span></div>
        </Panel>
      </div>
    </>
  );
}

export default function App() {
  const [page, setPage] = useState<Page>("Overview");
  const mainRef = useRef<HTMLElement>(null);
  const [now, setNow] = useState(new Date());
  const [noticeOpen, setNoticeOpen] = useState(false);
  const telemetry = useRobotData();
  const alerts = telemetry.alerts?.alerts ?? [];
  const rows = useMemo(() => makeEventRows(alerts), [alerts]);
  const settings: SettingsState = {
    gasWarning: telemetry.config ? String(telemetry.config.thresholds.gas_alarm_reset_adc) : "N/A",
    gasCritical: telemetry.config ? String(telemetry.config.thresholds.gas_alarm_adc) : "N/A",
    hysteresis: telemetry.config ? String(telemetry.config.thresholds.gas_alarm_adc - telemetry.config.thresholds.gas_alarm_reset_adc) : "N/A",
    calibration: "Not calibrated",
    incline: telemetry.config ? String(telemetry.config.thresholds.imu_max_inclination_deg) : "N/A",
    acceleration: telemetry.config ? String(telemetry.config.thresholds.imu_max_acceleration_mps2) : "N/A",
    diameter: "Not reported by API",
    resolution: "Not reported by API",
    gearRatio: "Not reported by API",
    separation: "N/A",
    email: "Not exposed by API",
    cooldown: telemetry.config ? String(telemetry.config.alert_cooldown_ms / 1000) : "N/A",
    notifications: null,
  };
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  const content = useMemo(() => {
    if (page === "Overview") return <Overview data={telemetry.data} status={telemetry.status} alerts={alerts} history={telemetry.history} simulation={telemetry.simulation} lastResponseAt={telemetry.lastResponseAt} onViewAlerts={() => setPage("Alert History")} />;
    if (page === "Gas Monitoring") return <GasPage settings={settings} data={telemetry.data} status={telemetry.status} history={telemetry.history} />;
    if (page === "Inertial Monitoring") return <InertialPage data={telemetry.data} status={telemetry.status} history={telemetry.history} />;
    if (page === "Odometry") return <OdometryPage data={telemetry.data} status={telemetry.status} history={telemetry.history} settings={settings} />;
    if (page === "Alert History") return <AlertPage rows={rows} alerts={alerts} lastSyncAt={telemetry.lastResponseAt} />;
    return <SettingsPage settings={settings} />;
  }, [page, telemetry, alerts, settings, rows]);
  const navigate = (name: Page) => { setPage(name); mainRef.current?.scrollTo({ top: 0 }); };
  const activeAlerts = alerts.filter((alert) => alert.status === "active");
  const systemLabel = telemetry.status?.system_status.toUpperCase() ?? (telemetry.connected ? "CONNECTING" : "API OFFLINE");
  const controllerOnline = Boolean(telemetry.status?.wifi_connected);
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand"><div className="brand-mark"><span /><i /></div><div><strong>ROBOT<span>MON</span></strong><small>ENGINEERING CONSOLE</small></div></div>
        <nav>{navItems.map((item) => <button key={item.name} className={page === item.name ? "active" : ""} onClick={() => navigate(item.name)}><Icon name={item.icon} /><span>{item.name}</span>{page === item.name && <i />}</button>)}</nav>
        <div className="sidebar-footer">
          <div className="connection-head"><span>CONTROLLER</span><StatusDot tone={controllerOnline ? "success" : "critical"} label={controllerOnline ? "ONLINE" : "OFFLINE"} /></div>
          <div className="device-name">ESP32-S3 <small>central controller</small></div>
          <dl>
            <div><dt>Address</dt><dd>{telemetry.status?.server_ip ?? "Unavailable"}</dd></div>
            <div><dt>Network</dt><dd><Icon name="wifi" size={13} />{controllerOnline ? "Wi-Fi connected" : "Disconnected"}</dd></div>
            <div><dt>Firmware</dt><dd>Not reported</dd></div>
          </dl>
        </div>
      </aside>
      <div className="main-area">
        <header className="topbar"><div className="topbar-left"><span className="breadcrumb">MONITOR / <strong>{page.toUpperCase()}</strong></span></div>
          <div className="topbar-right">
            <div className={"system-state " + (systemLabel === "ONLINE" ? "success" : systemLabel === "DEGRADED" ? "warning" : "critical")}><i />SYSTEM {systemLabel}</div>
            <time><strong>{now.toLocaleTimeString("en-GB")}</strong><span>{now.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }).toUpperCase()}</span></time>
            <div className="notification-wrap"><button className="notification" aria-label="Notifications" onClick={() => setNoticeOpen(!noticeOpen)}><Icon name="bell" />{activeAlerts.length > 0 && <i />}</button>
              {noticeOpen && <div className="notice-popover"><strong>Notifications</strong><p>{activeAlerts.length ? activeAlerts.length + " active alert(s)" : "No active alerts"}</p><span>{telemetry.error ?? (telemetry.simulation ? "Simulation mode is enabled." : "Alert state is provided by the controller API.")}</span></div>}
            </div>
          </div>
        </header>
        <main ref={mainRef}>{content}</main>
        <footer className="app-footer"><span>ROBOTMON engineering console | {telemetry.simulation ? "simulation mode" : "live API"}</span><span>REST endpoint <code>/api/data</code>{telemetry.error ? " | " + telemetry.error : ""}</span></footer>
      </div>
    </div>
  );
}
