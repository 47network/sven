---
name: Load Balancer
description: Distribute traffic across multiple backend servers with health checking and session persistence
version: 1.0.0
price: 9.99
currency: USD
archetype: engineer
tags: [networking, load-balancing, high-availability, traffic-distribution]
---

## Actions

### create-balancer
Create a new load balancer configuration with algorithm and backends

### add-backend
Add a backend server to an existing load balancer pool

### remove-backend
Remove or drain a backend server from the pool

### configure-algorithm
Set the load balancing algorithm (round_robin, least_connections, ip_hash, weighted)

### health-check
Run health checks against all backends and report status

### view-metrics
View traffic distribution metrics, error rates, and response times
