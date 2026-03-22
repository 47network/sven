# Legal Ingress Diagnose Capture

Timestamp: 2026-02-22T19:44:26.9878367+02:00
Install host: sven.example.com
App host: app.sven.example.com
Exit code: 0

```text
------------------------------------------------------------
47matrix ingress diagnostics
install_host=sven.example.com app_host=app.sven.example.com timeout=8s
timestamp=2026-02-22T19:44:29+02:00
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
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.023328s
curl -I https://sven.example.com/
curl: (28) Connection timed out after 8020 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.020215s
curl -I http://app.sven.example.com/
curl: (28) Connection timed out after 8014 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.014436s
curl -I https://app.sven.example.com/
curl: (28) Connection timed out after 8012 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.012165s
curl -I https://app.sven.example.com/healthz
curl: (28) Connection timed out after 8024 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.024939s
curl -I https://app.sven.example.com/readyz
curl: (28) Connection timed out after 8013 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.013105s
curl -I https://app.sven.example.com/privacy
curl: (28) Connection timed out after 8024 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.024498s
curl -I https://app.sven.example.com/terms
curl: (28) Connection timed out after 8024 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.024433s
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


