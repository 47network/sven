# Desktop Tauri Parity Check

- Time: 2026-02-14T19:47:42.405Z
- Status: pass
- Passed: 6
- Failed: 0

## Checks
- [x] device_auth_flow_commands: device_start, device_poll, refresh_session present in Tauri backend
- [x] chat_send_and_timeline_commands: send_message and fetch_timeline present in Tauri backend
- [x] approval_read_and_vote_commands: fetch_approvals and vote_approval present in Tauri backend
- [x] frontend_invokes_core_flows: frontend exposes login, refresh, send, approval vote, timeline refresh
- [x] api_bridge_parity_functions: api bridge exports parity functions
- [x] desktop_web_bundle_present: Vite desktop bundle exists at apps/companion-desktop-tauri/dist/index.html
