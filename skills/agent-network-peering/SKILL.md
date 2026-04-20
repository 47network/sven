# Agent Network Peering

Network peering management — VPC/VPN connections, routing tables, and transit gateways.

## Triggers
- `peering_create_connection` — Create a new peering connection
- `peering_add_route` — Add a route to a peering connection
- `peering_create_gateway` — Create a transit gateway
- `peering_attach_connection` — Attach a connection to a transit gateway
- `peering_check_status` — Check peering connection status and latency
- `peering_report` — Generate network peering statistics

## Outputs
- Peering connections with VPC/VPN/SD-WAN support
- Static and BGP route management with propagation
- Transit gateways with multi-connection aggregation
