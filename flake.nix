{
  description = "fantasy-hub development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs { inherit system; };
      in
      {
        devShells.default = pkgs.mkShell {
          packages = [
            pkgs.nodejs_22   # web: Next.js 15 (Node 22 LTS)
            pkgs.pnpm        # web package manager
            pkgs.python312   # api: FastAPI + nfl_data_py (3.12 for dep compatibility)
            pkgs.uv          # api dependency + venv manager
          ];

          shellHook = ''
            echo "fantasy-hub dev shell — node $(node --version), pnpm $(pnpm --version), python $(python3 --version), uv $(uv --version)"
          '';
        };
      });
}
