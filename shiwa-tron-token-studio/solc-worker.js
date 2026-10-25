self.onmessage = async (event) => {
  try {
    const input = event.data;
    const mod = await import("https://esm.sh/solc@0.8.30?bundle");
    const candidates = [mod, mod && mod.default, mod && mod.solc, mod && mod.default && mod.default.default];
    const compiler = candidates.find((x) => x && typeof x.compile === "function");
    if (!compiler) throw new Error("Solidity compiler module did not expose compile().");
    const raw = compiler.compile(JSON.stringify(input));
    const output = typeof raw === "string" ? JSON.parse(raw) : raw;
    self.postMessage({ ok: true, output, version: typeof compiler.version === "function" ? compiler.version() : "0.8.30" });
  } catch (error) {
    self.postMessage({ ok: false, error: error && error.message ? error.message : String(error) });
  }
};
