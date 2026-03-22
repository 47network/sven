{ config, lib, pkgs, ... }:

with lib;

let
  cfg = config.services.sven;
  defaultUser = "sven";
  defaultGroup = "sven";
  healthUrl = cfg.healthUrl;
  composeFile = toString cfg.composeFile;
  workingDir = toString cfg.workingDir;
  configFile = toString cfg.configFile;

  dockerCompose = "${pkgs.docker}/bin/docker compose";
  curl = "${pkgs.curl}/bin/curl";
  test = "${pkgs.coreutils}/bin/test";

in {
  options.services.sven = {
    enable = mkEnableOption "Sven gateway";

    user = mkOption {
      type = types.str;
      default = defaultUser;
      description = "User account for the Sven gateway service.";
    };

    group = mkOption {
      type = types.str;
      default = defaultGroup;
      description = "Group for the Sven gateway service.";
    };

    workingDir = mkOption {
      type = types.path;
      default = "/opt/sven";
      description = "Working directory where docker-compose.yml lives.";
    };

    composeFile = mkOption {
      type = types.path;
      default = "/opt/sven/docker-compose.yml";
      description = "Path to docker-compose.yml.";
    };

    configFile = mkOption {
      type = types.path;
      default = "/opt/sven/config/sven.json";
      description = "Path to sven.json configuration file.";
    };

    environment = mkOption {
      type = types.attrsOf types.str;
      default = {};
      description = "Extra environment variables for the gateway service.";
    };

    gatewayPort = mkOption {
      type = types.int;
      default = 3000;
      description = "Gateway port for health checks.";
    };

    gatewayHost = mkOption {
      type = types.str;
      default = "0.0.0.0";
      description = "Gateway bind host.";
    };

    healthUrl = mkOption {
      type = types.str;
      default = "http://127.0.0.1:3000/healthz";
      description = "Health check URL used by systemd ExecStartPre.";
    };
  };

  config = mkIf cfg.enable {
    users.groups = mkIf (cfg.group == defaultGroup) { ${defaultGroup} = {}; };
    users.users = mkIf (cfg.user == defaultUser) {
      ${defaultUser} = {
        isSystemUser = true;
        group = cfg.group;
        home = "/var/lib/sven";
        createHome = true;
      };
    };

    systemd.services.sven-gateway = {
      description = "Sven Gateway";
      wantedBy = [ "multi-user.target" ];
      after = [ "network-online.target" "docker.service" ];
      wants = [ "network-online.target" "docker.service" ];

      serviceConfig = {
        User = cfg.user;
        Group = cfg.group;
        WorkingDirectory = workingDir;
        ExecStartPre = [
          "${test} -f ${composeFile}"
          "${curl} -fsS ${healthUrl} || true"
        ];
        ExecStart = "${dockerCompose} -f ${composeFile} up gateway-api";
        ExecStop = "${dockerCompose} -f ${composeFile} stop gateway-api";
        Restart = "always";
        RestartSec = 5;
      };

      environment = cfg.environment // {
        SVEN_CONFIG = configFile;
        GATEWAY_HOST = cfg.gatewayHost;
        GATEWAY_PORT = toString cfg.gatewayPort;
      };
    };
  };
}
