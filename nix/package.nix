{
  lib,
  buildNpmPackage,
  nodejs_22,
  makeWrapper,
  promptfoo,
  autoPatchelfHook,
  stdenv,
}:
buildNpmPackage {
  pname = "agent-evals";
  version = (lib.importJSON ../package.json).version;
  nodejs = nodejs_22;

  src = lib.fileset.toSource {
    root = ../.;
    fileset = lib.fileset.unions [
      ../package.json
      ../package-lock.json
      ../tsconfig.json
      ../tsconfig.build.json
      ../src
    ];
  };

  npmDepsHash = "sha256-aGGRH3STBZpNqy4EkTJhkmOQ8pKnpSjJpbAehSIwxbw=";
  npmFlags = [ "--ignore-scripts" ];

  nativeBuildInputs = [ makeWrapper ] ++ lib.optionals stdenv.isLinux [ autoPatchelfHook ];
  autoPatchelfIgnoreMissingDeps = true;

  postInstall = ''
    wrapProgram $out/bin/agent-evals --prefix PATH : ${lib.makeBinPath [ promptfoo ]}
  '';

  meta = {
    description = "Regression suite for AI agent instructions, scripts, hooks and MCP servers";
    license = lib.licenses.mit;
    mainProgram = "agent-evals";
  };
}
