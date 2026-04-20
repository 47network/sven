# Agent IP Allowlisting

IP-based access control — allowlists, CIDR rules, and access audit logging.

## Triggers
- `ipallow_create_list` — Create a new IP allowlist with enforcement mode
- `ipallow_add_rule` — Add a CIDR rule to an allowlist
- `ipallow_remove_rule` — Remove a CIDR rule from an allowlist
- `ipallow_check_ip` — Check if an IP is allowed by a specific list
- `ipallow_list_logs` — View access logs for blocked/allowed IPs
- `ipallow_report` — Generate IP allowlisting statistics

## Outputs
- Allowlists with enforce/audit/disabled modes
- CIDR rules with priorities and expiration
- Access logs with geo-location and matched rule tracking
