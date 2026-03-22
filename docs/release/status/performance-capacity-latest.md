# Performance Capacity Check

Generated: 2026-02-22T15:11:44.708Z
API base: http://127.0.0.1:3000
Status: fail
Duration per scenario: 5s
Concurrency: 6

## Aggregate
- requests: 76930
- success: 300
- errors: 76630
- error_rate: 0.9961

## Scenarios
- chat_list (GET /v1/admin/chats?per_page=20)
  rps=3560.6, error_rate=0.9831, p95=3ms, p99=6ms, headroom=237.37x
- approvals_list (GET /v1/admin/approvals?status=pending&per_page=20)
  rps=3927.2, error_rate=1, p95=2ms, p99=3ms, headroom=261.81x
- admin_metrics_summary (GET /v1/admin/performance/metrics/summary)
  rps=3934.8, error_rate=1, p95=2ms, p99=3ms, headroom=491.85x
- admin_queue_status (GET /v1/admin/performance/queue-status)
  rps=3963.4, error_rate=1, p95=2ms, p99=3ms, headroom=495.43x

## Checks
- [x] chat_list:rps: 3560.6 >= 15
- [x] chat_list:p95: 3 <= 700
- [x] chat_list:p99: 6 <= 1200
- [ ] chat_list:error_rate: 0.9831 <= 0.05
- [x] chat_list:headroom: 237.37 >= 1.25
- [x] approvals_list:rps: 3927.2 >= 15
- [x] approvals_list:p95: 2 <= 700
- [x] approvals_list:p99: 3 <= 1200
- [ ] approvals_list:error_rate: 1 <= 0.05
- [x] approvals_list:headroom: 261.81 >= 1.25
- [x] admin_metrics_summary:rps: 3934.8 >= 8
- [x] admin_metrics_summary:p95: 2 <= 1200
- [x] admin_metrics_summary:p99: 3 <= 2000
- [ ] admin_metrics_summary:error_rate: 1 <= 0.05
- [x] admin_metrics_summary:headroom: 491.85 >= 1.25
- [x] admin_queue_status:rps: 3963.4 >= 8
- [x] admin_queue_status:p95: 2 <= 900
- [x] admin_queue_status:p99: 3 <= 1500
- [ ] admin_queue_status:error_rate: 1 <= 0.05
- [x] admin_queue_status:headroom: 495.43 >= 1.25

