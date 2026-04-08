# VM Restart Drill

Generated: 2026-03-24T01:11:56.688Z
Status: planned
Execution mode: planned
Env file: deploy/multi-vm/.env
Head SHA: e936b3c8ce930fb8bb6d34cde9fe130fef2e8653

## Commands
- [x] vm5_restart_wait: sudo docker compose -f deploy/multi-vm/docker-compose.vm5-ai.yml --env-file deploy/multi-vm/.env up -d --wait -> plan-only (execution not requested)
- [x] vm5_status: sudo docker compose -f deploy/multi-vm/docker-compose.vm5-ai.yml --env-file deploy/multi-vm/.env ps -> plan-only (execution not requested)
- [x] vm7_restart_wait: sudo docker compose -f deploy/multi-vm/docker-compose.vm7-adapters.yml --env-file deploy/multi-vm/.env --profile adapters --profile tunnel up -d --wait -> plan-only (execution not requested)
- [x] vm7_status: sudo docker compose -f deploy/multi-vm/docker-compose.vm7-adapters.yml --env-file deploy/multi-vm/.env --profile adapters --profile tunnel ps -> plan-only (execution not requested)
- [x] repo_contract: npm run -s release:multi-vm:restart:health:check -> plan-only (execution not requested)

