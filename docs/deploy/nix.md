# Nix Deployment

This repo ships a minimal Nix flake and a NixOS module for running the Sven gateway.

## Dev Shell

```bash
nix develop
```

This provides:
- Node.js 20 + pnpm
- docker + docker-compose
- postgres client tools
- curl

## NixOS Module

Enable the module in your NixOS configuration:

```nix
{
  inputs.sven.url = "path:/opt/sven";

  outputs = { self, nixpkgs, sven, ... }:
  {
    nixosConfigurations.myhost = nixpkgs.lib.nixosSystem {
      system = "x86_64-linux";
      modules = [
        sven.nixosModules.sven
        {
          services.sven = {
            enable = true;
            workingDir = "/opt/sven";
            composeFile = "/opt/sven/docker-compose.yml";
            configFile = "/opt/sven/config/sven.json";
            environment = {
              SVEN_GATEWAY_URL = "http://0.0.0.0:3000";
            };
          };
        }
      ];
    };
  };
}
```

## Notes

- The module runs `docker compose up gateway-api` in `workingDir`.
- Health check runs via `ExecStartPre` using the configured `healthUrl`.
- The gateway reads `SVEN_CONFIG` (defaults to `/opt/sven/config/sven.json`).

