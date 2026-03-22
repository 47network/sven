# Legal Ingress Diagnose Capture

Timestamp: 2026-02-22T20:06:07.1669100+02:00
Install host: sven.example.com
App host: app.sven.example.com
Exit code: 0

```text
------------------------------------------------------------
47matrix ingress diagnostics
install_host=sven.example.com app_host=app.sven.example.com timeout=8s
timestamp=2026-02-22T20:06:09+02:00
------------------------------------------------------------
DNS resolution
host: sven.example.com
86.122.81.64    sven.example.com
host: app.sven.example.com
86.122.81.64    app.sven.example.com
------------------------------------------------------------
Remote HTTP/HTTPS probes
curl -I http://sven.example.com/
curl: (28) Connection timed out after 8025 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.025346s
curl -I https://sven.example.com/
curl: (28) Connection timed out after 8019 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.019729s
curl -I http://app.sven.example.com/
curl: (28) Connection timed out after 8024 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.024298s
curl -I https://app.sven.example.com/
curl: (28) Connection timed out after 8019 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.019882s
curl -I https://app.sven.example.com/healthz
curl: (28) Connection timed out after 8011 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.011876s
curl -I https://app.sven.example.com/readyz
curl: (28) Connection timed out after 8023 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.023586s
curl -I https://app.sven.example.com/privacy
curl: (28) Connection timed out after 8019 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.019366s
curl -I https://app.sven.example.com/terms
curl: (28) Connection timed out after 8022 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.022623s
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


