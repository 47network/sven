# Edge and Network Delivery Check

Generated: 2026-02-16T02:10:50.556Z
Status: pass
Install host: https://sven.example.com
App host: https://app.sven.example.com
Min TLS validity days: 14

## Checks
- [x] domain_split_installers_conf_present: config/nginx/extnginx-sven-installers.conf has sven.example.com
- [x] domain_split_app_conf_present: config/nginx/extnginx-sven-app.conf has app.sven.example.com
- [x] http_to_https_redirect_install_host: http://sven.example.com/ -> 301 (expected 301)
- [x] http_to_https_redirect_app_host: http://app.sven.example.com/ -> 301 (expected 301)
- [x] install_sh_served: https://sven.example.com/install.sh -> 200 (expected 200)
- [x] install_ps1_served: https://sven.example.com/install.ps1 -> 200 (expected 200)
- [x] install_cmd_served: https://sven.example.com/install.cmd -> 200 (expected 200)
- [x] app_ready_endpoint_ok: https://app.sven.example.com/readyz -> 200 (expected 200)
- [x] tls_monitor_install_host: sven.example.com: cert valid_to=2026-05-14, days_remaining=87, min_required=14
- [x] tls_monitor_app_host: app.sven.example.com: cert valid_to=2026-05-14, days_remaining=87, min_required=14
- [x] rate_limit_policy_config_present: config/nginx/extnginx-rate-limit-policy.conf includes limit_req_zone and limit_req
- [x] abuse_controls_doc_present: docs/deploy/edge-rate-limit-and-abuse-controls-2026.md


