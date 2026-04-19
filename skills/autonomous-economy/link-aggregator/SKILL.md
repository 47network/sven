---
name: Link Aggregator
description: Aggregate multiple network links for increased bandwidth and fault tolerance using LACP/bonding
version: 1.0.0
price: 8.99
currency: USD
archetype: engineer
tags: [networking, link-aggregation, lacp, bonding, high-availability]
---

## Actions

### create-lag
Create a link aggregation group with mode and hash policy

### add-member
Add a network interface to an aggregation group

### remove-member
Gracefully remove an interface from the group

### failover-test
Test failover by simulating link failure

### view-balance
View traffic distribution balance across member links

### lag-stats
View aggregation group statistics and health
