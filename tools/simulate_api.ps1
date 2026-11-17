param(
  [Parameter(Mandatory = $true)]
  [string]$BaseUrl
)

# Development-only simulated sensor traffic. This does not run on any ESP32
# node and must never be enabled as production telemetry.
$base = $BaseUrl.TrimEnd('/')
$samples = @(
  @{ Path = '/api/gas'; Body = @{ schema_version = '1.0'; node_id = 'gas_node'; uptime_ms = 123456; sensor_status = 'ok'; data = @{ adc_raw = 1250; voltage_v = 1.01; warmup_complete = $true; risk_level = 'normal'; alarm_active = $false } } },
  @{ Path = '/api/imu'; Body = @{ schema_version = '1.0'; node_id = 'imu_node'; uptime_ms = 123456; sensor_status = 'ok'; data = @{ ax_mps2 = 0.01; ay_mps2 = 0.02; az_mps2 = 9.80; gx_dps = 0.1; gy_dps = -0.2; gz_dps = 0.0; roll_deg = 0.12; pitch_deg = -0.08 } } },
  @{ Path = '/api/encoders'; Body = @{ schema_version = '1.0'; node_id = 'encoder_node'; uptime_ms = 123456; sensor_status = 'ok'; data = @{ left_rpm = 0.0; right_rpm = 0.0; left_distance_m = 0.0; right_distance_m = 0.0; distance_m = 0.0; linear_speed_mps = 0.0; heading_change_rad = $null } } }
)

foreach ($sample in $samples) {
  $json = $sample.Body | ConvertTo-Json -Depth 8 -Compress
  $response = Invoke-RestMethod -Method Post -Uri ($base + $sample.Path) -ContentType 'application/json' -Body $json
  if (-not $response.accepted) { throw "Server did not accept $($sample.Path)" }
  Write-Output ("POST {0}: accepted={1}" -f $sample.Path, $response.accepted)
}

foreach ($path in @('/api/data', '/api/status', '/api/alerts', '/api/config')) {
  $response = Invoke-RestMethod -Method Get -Uri ($base + $path)
  Write-Output ("GET {0}: schema_version={1}" -f $path, $response.schema_version)
}
