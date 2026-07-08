import { WebSocketServer } from "ws";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// Resolve the claude binary (GUI/minimal-PATH safe).
function findClaude() {
  const home = homedir();
  const candidates = [
    process.env.RAISEME_CLAUDE,
    join(home, ".local/bin/claude"),
    join(home, ".claude/local/claude"),
    "/opt/homebrew/bin/claude",
    "/usr/local/bin/claude"
  ].filter(Boolean);
  return candidates.find((p) => existsSync(p)) || "claude";
}

// Browser-preview fallback only: streams a local claude PTY over /ws. The native desktop app runs
// claude directly (Rust PTY), and the cloud portal has no claude — so node-pty is lazy-loaded and
// any failure is non-fatal (the server still serves the management portal).
export function attachTerminal(server) {
  const wss = new WebSocketServer({ noServer: true });

  server.on("upgrade", (req, socket, head) => {
    const url = new URL(req.url, "http://localhost");
    if (url.pathname !== "/ws") { socket.destroy(); return; }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });

  wss.on("connection", async (ws, req) => {
    let pty;
    try { pty = (await import("node-pty")).default; }
    catch { ws.send("\r\n[RAISEME] terminal not available on this host.\r\n"); ws.close(); return; }

    const token = new URL(req.url, "http://localhost").searchParams.get("token") || "";
    const env = { ...process.env, TERM: "xterm-256color" };
    if (token.startsWith("sk-ant-oat")) env.CLAUDE_CODE_OAUTH_TOKEN = token;
    else if (token) env.ANTHROPIC_API_KEY = token;

    let term;
    try {
      term = pty.spawn(findClaude(), [], { name: "xterm-color", cols: 80, rows: 24, cwd: homedir(), env });
    } catch (e) {
      ws.send(`\r\n[RAISEME] failed to start claude: ${e.message}\r\n`);
      ws.close();
      return;
    }

    term.onData((d) => { if (ws.readyState === ws.OPEN) ws.send(d); });
    term.onExit(({ exitCode }) => {
      if (ws.readyState === ws.OPEN) { ws.send(`\r\n[RAISEME] claude exited (${exitCode}).\r\n`); ws.close(); }
    });

    ws.on("message", (msg) => {
      const s = msg.toString();
      if (s.startsWith("\x00resize:")) {
        const [, c, r] = s.split(":");
        try { term.resize(Number(c), Number(r)); } catch {}
      } else {
        term.write(s);
      }
    });
    ws.on("close", () => { try { term.kill(); } catch {} });
  });
}
