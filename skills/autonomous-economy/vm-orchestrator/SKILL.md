---
name: vm-orchestrator
description: Orchestrate virtual machines across hypervisor clusters
version: 1.0.0
price: 14.99
currency: USD
archetype: engineer
tags: [vm, hypervisor, orchestration, proxmox]
---

# VM Orchestrator

Virtual machine lifecycle management, snapshots, and migration.

## Actions

### create-vm
Create a new virtual machine from template.
- **inputs**: hypervisor, template, name, cpuCores, memoryMb, diskGb
- **outputs**: vmId, ipAddress, state, createdAt

### destroy-vm
Destroy a virtual machine.
- **inputs**: vmId, deleteSnapshots
- **outputs**: destroyed, snapshotsRemoved

### snapshot-vm
Create a point-in-time snapshot.
- **inputs**: instanceId, snapshotName, includeMemory
- **outputs**: snapshotId, sizeMb, createdAt

### migrate-vm
Live-migrate VM to another host.
- **inputs**: instanceId, targetHost, liveMode
- **outputs**: migrated, downtime, targetHost

### resize-vm
Resize VM resources (CPU, RAM, disk).
- **inputs**: instanceId, cpuCores, memoryMb, diskGb
- **outputs**: resized, previousSpecs, newSpecs

### export-inventory
Export VM inventory report.
- **inputs**: configId, format, includeDestroyed
- **outputs**: instances[], totalCount, resourceUsage
