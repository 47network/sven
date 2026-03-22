# Docker Compose Profiles Check

Generated: 2026-02-21T19:52:53.502Z
Status: pass

## Counts
- base: 23
- dev: 23
- staging: 23
- production: 23

## Checks
- [x] required_profile_compose_files_present: docker-compose.yml, docker-compose.profiles.yml, docker-compose.dev.yml, docker-compose.staging.yml, docker-compose.production.yml
- [x] docker_compose_profile_resolution_succeeds: docker compose config --services succeeded for dev/staging/production profiles
- [x] profile_service_sets_match_base: base=23, dev=23, staging=23, production=23

