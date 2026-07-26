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

          # Python binary wheels (duckdb, psycopg-binary, ...) link against the
          # C++ stdlib and zlib, which aren't on the default library path in a
          # pure Nix shell. Expose them so the wheels load.
          shellHook = ''
            export LD_LIBRARY_PATH="${pkgs.lib.makeLibraryPath [ pkgs.stdenv.cc.cc.lib pkgs.zlib ]}''${LD_LIBRARY_PATH:+:$LD_LIBRARY_PATH}"
            echo "fantasy-hub dev shell — node $(node --version), pnpm $(pnpm --version), python $(python3 --version), uv $(uv --version)"
          '';
        };
      });
}
