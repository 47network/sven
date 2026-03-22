{
  description = "Sven - AI assistant platform";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-24.05";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system: let
      pkgs = import nixpkgs { inherit system; };
    in {
      devShells.default = pkgs.mkShell {
        packages = with pkgs; [
          nodejs_20
          pnpm
          git
          docker
          docker-compose
          postgresql
          curl
        ];
        shellHook = ''
          echo "Sven devShell ready (node $(node --version))"
        '';
      };
    }) // {
      nixosModules.sven = import ./nix/sven.nix;
    };
}
