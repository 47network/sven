# ═══════════════════════════════════════════════════════════════════════
# Sven Multi-VM — WireGuard Mesh Configuration
# ═══════════════════════════════════════════════════════════════════════
#
# Topology (extends 47Dynamics mesh):
#
#   47Dynamics VMs (existing):
#     VM1 (Platform)  10.47.47.5  / wg0: 10.47.0.3
#     VM2 (Data)      10.47.47.6  / wg0: 10.47.0.4
#     VM3 (Apps)      10.47.47.7  / wg0: 10.47.0.5
#
#   Sven VMs (new):
#     VM4 (Platform)  10.47.47.8  / wg0: 10.47.0.6
#     VM5 (AI)        10.47.47.9  / wg0: 10.47.0.7
#     VM6 (Data)      10.47.47.10 / wg0: 10.47.0.8
#     VM7 (Adapters)  10.47.47.11 / wg0: 10.47.0.9
#
#   Cloud Relay:
#     Relay           __CLOUD_IP__:51820 / wg0: 10.47.0.1
#
# Setup:
#   1. On each Sven VM, generate a keypair:
#        wg genkey | tee /etc/wireguard/private.key | wg pubkey > /etc/wireguard/public.key
#        chmod 600 /etc/wireguard/private.key
#   2. Copy the appropriate wg0.vmN.conf to /etc/wireguard/wg0.conf
#   3. Replace all __*__ placeholders with real values
#   4. Enable: systemctl enable --now wg-quick@wg0
#   5. Verify: wg show
#
# The gRPC bridge (VM4 bridge-47dynamics ↔ VM1 api-go) traverses
# the encrypted WireGuard mesh via 10.47.0.x addresses.
# ═══════════════════════════════════════════════════════════════════════
