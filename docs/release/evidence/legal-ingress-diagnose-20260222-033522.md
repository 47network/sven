# Legal Ingress Diagnose Capture

Timestamp: 2026-02-22T03:35:22.9174354+02:00
Install host: sven.example.com
App host: app.sven.example.com
Exit code: 0

```text
------------------------------------------------------------
47matrix ingress diagnostics
install_host=sven.example.com app_host=app.sven.example.com timeout=8s
timestamp=2026-02-22T03:35:23+02:00
------------------------------------------------------------
DNS resolution
host: sven.example.com
86.122.81.64    sven.example.com
host: app.sven.example.com
86.122.81.64    app.sven.example.com
------------------------------------------------------------
Remote HTTP/HTTPS probes
curl -I http://sven.example.com/
curl: (28) Connection timed out after 8036 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.036236s
curl -I https://sven.example.com/
curl: (28) Connection timed out after 8031 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.031539s
curl -I http://app.sven.example.com/
curl: (28) Connection timed out after 8001 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.001208s
curl -I https://app.sven.example.com/
curl: (28) Connection timed out after 8034 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.034840s
curl -I https://app.sven.example.com/healthz
curl: (28) Connection timed out after 8035 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.034394s
curl -I https://app.sven.example.com/readyz
curl: (28) Connection timed out after 8032 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.032642s
curl -I https://app.sven.example.com/privacy
curl: (28) Connection timed out after 8028 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.028510s
curl -I https://app.sven.example.com/terms
curl: (28) Connection timed out after 8035 milliseconds
status=000 remote_ip= connect=0.000000s appconnect=0.000000s total=8.035526s
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


