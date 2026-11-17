# SMTP configuration plan

Only the central ESP32-S3 will send alert email. SMTP host, port, username,
password, sender and recipient are represented by placeholders in
`include/secrets.example.h`. Copy it to the ignored `include/secrets.h` and
keep real values out of source control. Verify the provider's current endpoint,
authentication method, TLS mode and certificate requirements before use.

Port 465 commonly indicates implicit TLS and port 587 commonly indicates
STARTTLS, but the provider's documented configuration is authoritative. Email
work will use a bounded queue, deduplication and configurable cooldown so a
persistent alarm does not send repeatedly and SMTP delays do not block HTTP
receive handling. Log delivery failures without exposing credentials. Email
is a notification channel, not a guaranteed safety mechanism.
