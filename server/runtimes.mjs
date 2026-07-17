import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";

export function runProcess(command, args, { workspace, timeoutMs = 10 * 60 * 1000, input = "" }) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { cwd: workspace, env: process.env, stdio: ["pipe", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    let outputSize = 0;
    const maxOutput = 2 * 1024 * 1024;
    const collect = (target) => (chunk) => {
      outputSize += chunk.length;
      if (outputSize > maxOutput) child.kill("SIGTERM");
      else target.push(chunk);
    };
    child.stdout.on("data", collect(stdout));
    child.stderr.on("data", collect(stderr));
    child.stdin.on("error", () => undefined);
    child.stdin.end(input);
    child.on("error", rejectRun);
    const timeout = setTimeout(() => child.kill("SIGTERM"), timeoutMs);
    child.on("close", (code, signal) => {
      clearTimeout(timeout);
      if (outputSize > maxOutput) return rejectRun(new Error("Agent response exceeds allowed limit"));
      resolveRun({ code, signal, stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") });
    });
  });
}

export function parseCodexOutput(output) {
  let reply = "";
  let sessionId = "";
  for (const line of output.split("\n")) {
    if (!line.trim().startsWith("{")) continue;
    try {
      const event = JSON.parse(line);
      if (event.type === "thread.started") sessionId = String(event.thread_id || "");
      if (event.type === "item.completed" && event.item?.type === "agent_message") reply = String(event.item.text || "");
    } catch {
      // The CLI can mix diagnostic output with JSON events.
    }
  }
  return { reply: reply.trim(), sessionId };
}

export function createRuntimeBridge({ workspace, runner = runProcess }) {
  async function chatWithPi({ message, mode, sessionId }) {
    const safeSessionId = /^[0-9a-f-]{36}$/i.test(sessionId || "") ? sessionId : randomUUID();
    const systemPrompt = mode === "build"
      ? "You are PI, orchestrator of the VPS. This gateway is intentionally read-only: inspect and suggest, then clearly identify changes to delegate to Codex."
      : "You are PI, orchestrator of the VPS. Work in read-only mode, observe the actual state, and respond concisely and verifiably.";
    const result = await runner("sudo", [
      "-n", "pi", "--print", "--approve", "--session-id", safeSessionId,
      "--tools", "read,grep,find,ls", "--append-system-prompt", systemPrompt,
    ], { workspace, input: `[Mode ${mode}] ${message}\n` });
    if (result.code !== 0) throw new Error(result.stderr.trim() || `PI stopped with code ${result.code}`);
    return { reply: result.stdout.trim(), sessionId: safeSessionId, sessionReset: false, safety: "read-only" };
  }

  async function chatWithCodex({ message, mode, sessionId }) {
    const sandbox = mode === "build" ? "systemd-workspace-write" : "systemd-read-only";
    const prompt = `[Mode ${mode}] ${message}`;
    const writablePaths = mode === "build" ? `${workspace} /home/codex/.codex` : "/home/codex/.codex";
    const isolationArgs = [
      "-n", "systemd-run", "--pipe", "--wait", "--quiet", "--collect",
      "-p", "User=codex", "-p", "Group=codex", "-p", `WorkingDirectory=${workspace}`,
      "-p", "NoNewPrivileges=yes", "-p", "PrivateTmp=yes", "-p", "PrivateDevices=yes",
      "-p", "ProtectSystem=strict", "-p", "ProtectHome=read-only",
      "-p", "ProtectKernelTunables=yes", "-p", "ProtectKernelModules=yes",
      "-p", "ProtectControlGroups=yes", "-p", "RestrictSUIDSGID=yes", "-p", "LockPersonality=yes",
      "-p", `ReadWritePaths=${writablePaths}`,
      "-p", "BindReadOnlyPaths=/home/codex/.codex/auth.json /home/codex/.codex/config.toml /home/codex/.codex/plugins /home/codex/.codex/skills /home/codex/.codex/attachments /home/codex/.codex/visualizations",
    ];
    const globalArgs = ["codex", "-a", "never", "--sandbox", "danger-full-access", "exec"];
    const requestedSessionId = /^[0-9a-f-]{36}$/i.test(sessionId || "") ? sessionId : "";
    const argsFor = (resumeId = "") => resumeId
      ? [...isolationArgs, ...globalArgs, "resume", "--json", resumeId, "-"]
      : [...isolationArgs, ...globalArgs, "--json", "--color", "never", "-C", workspace, "-"];
    let result = await runner("sudo", argsFor(requestedSessionId), { workspace, input: `${prompt}\n` });
    let sessionReset = false;
    if (requestedSessionId && result.code !== 0 && /no rollout found for thread id/i.test(`${result.stderr}\n${result.stdout}`)) {
      result = await runner("sudo", argsFor(), { workspace, input: `${prompt}\n` });
      sessionReset = true;
    }
    const parsed = parseCodexOutput(result.stdout);
    if (result.code !== 0 || !parsed.reply) {
      const detail = result.stderr.trim() || result.stdout.trim() || `Codex stopped with code ${result.code}`;
      throw new Error(detail.slice(-1200));
    }
    return { reply: parsed.reply, sessionId: parsed.sessionId || requestedSessionId, sessionReset, safety: sandbox };
  }

  return { pi: chatWithPi, codex: chatWithCodex };
}
