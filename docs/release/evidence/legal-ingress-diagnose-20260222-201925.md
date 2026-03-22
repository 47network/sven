# Legal Ingress Diagnose Capture

Timestamp: 2026-02-22T20:19:25.2299342+02:00
Install host: sven.example.com
App host: app.sven.example.com
Exit code: 0

```text
------------------------------------------------------------
47matrix ingress diagnostics
install_host=sven.example.com app_host=app.sven.example.com timeout=8s
timestamp=2026-02-22T20:19:28+02:00
------------------------------------------------------------
DNS resolution
host: sven.example.com
86.122.81.64    sven.example.com
host: app.sven.example.com
86.122.81.64    app.sven.example.com
------------------------------------------------------------
Remote HTTP/HTTPS probes
curl -I http://sven.example.com/
curl: (28) Connection timed out after 8024 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.024685s
curl -I https://sven.example.com/
curl: (28) Connection timed out after 8020 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.020097s
curl -I http://app.sven.example.com/
curl: (28) Connection timed out after 8019 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.019093s
curl -I https://app.sven.example.com/
curl: (28) Connection timed out after 8016 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.016896s
curl -I https://app.sven.example.com/healthz
curl: (28) Connection timed out after 8011 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.011957s
curl -I https://app.sven.example.com/readyz
curl: (28) Connection timed out after 8018 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.018487s
curl -I https://app.sven.example.com/privacy
curl: (28) Connection timed out after 8023 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.023913s
curl -I https://app.sven.example.com/terms
curl: (28) Connection timed out after 8023 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.023460s
------------------------------------------------------------
Local listener snapshot (if running on edge host)
LISTEN 0      4096                *:8088             *:*          
------------------------------------------------------------
Nginx status (if present)
missing command: nginx
inactive
------------------------------------------------------------
Firewall snapshot (if present)
missing command: ufw
missing command: nft
missing command: iptables
------------------------------------------------------------
Done
If HTTP/HTTPS probes timeout and local :80/:443 are not listening, fix edge listener/bind first.
```


