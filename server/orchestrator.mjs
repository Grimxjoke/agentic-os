import { redact } from "./security.mjs";

function compact(value, max = 1200) {
  return String(redact(String(value ?? ""))).replace(/\s+/g, " ").trim().slice(0, max);
}

function publicPayload(value, key = "") {
  const redacted = redact(value, key);
  if (typeof redacted === "string" && /(?:path|directory|dir|home|root|cwd|file)/i.test(key) && (/^\//.test(redacted) || /^file:/i.test(redacted))) return "[PRIVATE_PATH]";
  if (Array.isArray(redacted)) return redacted.map((item) => publicPayload(item, key));
  if (redacted && typeof redacted === "object") return Object.fromEntries(Object.entries(redacted).map(([childKey, child]) => [childKey, publicPayload(child, childKey)]));
  return redacted;
}

function publicArtifactUri(value) {
  const uri = compact(value, 1000);
  if (/^(?:vibe|artifact):\/\/[A-Za-z0-9._~!$&'()*+,;=:@%/-]+$/.test(uri)) return uri;
  const name = uri.replace(/\\/g, "/").split("/").pop() || "artifact";
  return `vibe-artifact://${encodeURIComponent(name)}`;
}

function toolAllowed(name, agent) {
  const tool = String(name || "").toLowerCase();
  const allowed = new Set((agent.tools || []).map((value) => String(value).toLowerCase()));
  if (!tool) return false;
  if (/(?:trade|order|broker|buy|sell|position)/.test(tool)) return false;
  if (/(?:shell|bash|terminal|command_exec)/.test(tool)) return false;
  if (/(?:web|search|http|browser|url)/.test(tool) && agent.policy?.network === "deny") return false;
  if (/(?:write|edit|delete|move|rename)/.test(tool) && agent.policy?.filesystem !== "write") return false;
  if (/(?:file|directory|glob|read)/.test(tool) && agent.policy?.filesystem === "deny") return false;
  if (allowed.has(tool)) return true;
  const categories = [
    ["filesystem", /(?:file|directory|glob|read|write|edit)/], ["web", /(?:web|search|http|url)/],
    ["browser", /browser/], ["git", /git/], ["python", /python/], ["images", /image|vision/], ["reports", /report/],
  ];
  return categories.some(([category, pattern]) => allowed.has(category) && pattern.test(tool));
}

function sessionIdentifier(value) {
  return value?.session_id || value?.id || value?.sessionId || "";
}

function usageFrom(data, current) {
  const total = Number(data.total_tokens ?? data.totalTokens ?? data.tokens ?? 0);
  const input = Number(data.input_tokens ?? data.prompt_tokens ?? 0);
  const output = Number(data.output_tokens ?? data.completion_tokens ?? 0);
  const cost = Number(data.cost_usd ?? data.cost ?? 0);
  return {
    tokens: Number.isFinite(total || input + output) ? Math.max(current.tokens || 0, total || input + output) : current.tokens,
    costUsd: Number.isFinite(cost) && cost >= 0 ? Math.max(current.costUsd || 0, cost) : current.costUsd,
  };
}

function parseFrame(frame) {
  let id = "";
  let type = "message";
  const dataLines = [];
  for (const line of frame.split(/\r?\n/)) {
    if (line.startsWith("id:")) id = line.slice(3).trim();
    if (line.startsWith("event:")) type = line.slice(6).trim();
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  let data = {};
  try { data = JSON.parse(dataLines.join("\n") || "{}"); } catch { data = { raw: compact(dataLines.join("\n"), 800) }; }
  return { id, type, data };
}

function artifactFrom(type, data) {
  const value = data.artifact || data.file || data.output || null;
  const uri = data.uri || data.file_path || data.path || value?.uri || value?.path;
  if (!uri || (!type.includes("artifact") && !data.artifact && !data.file_path)) return null;
  return {
    name: compact(data.name || data.filename || value?.name || String(uri).split("/").pop() || "Artifact", 200),
    kind: compact(data.kind || data.type || type, 80),
    uri: publicArtifactUri(uri),
    bytes: Number.isFinite(Number(data.bytes || value?.bytes)) ? Number(data.bytes || value?.bytes) : null,
    checksum: data.checksum || value?.checksum || null,
  };
}

export function createVibeWorkerExecutor(vibe) {
  let cachedOverview = null;
  let overviewAt = 0;
  return {
    async execute({ run, worker, node, upstreamOutputs, signal, emit, setSession, artifact }) {
      if (signal.aborted) throw new DOMException("Annulé", "AbortError");
      if (typeof vibe.overview === "function" && (!cachedOverview || Date.now() - overviewAt > 30_000)) {
        cachedOverview = await vibe.overview();
        overviewAt = Date.now();
      }
      if (cachedOverview) {
        if (!cachedOverview.ready) throw new Error(cachedOverview.reason || "Provider Vibe non prêt");
        const configuredProvider = String(cachedOverview.provider?.name || "").toLowerCase();
        const configuredModel = String(cachedOverview.provider?.model || "").toLowerCase();
        if (configuredProvider && configuredProvider !== String(node.agent.provider).toLowerCase()) throw new Error(`Provider ${node.agent.provider} non disponible dans Vibe`);
        if (configuredModel && !configuredModel.endsWith(String(node.agent.model).toLowerCase())) throw new Error(`Modèle ${node.agent.model} non disponible dans Vibe`);
      }
      const created = await vibe.sessions.create({ title: `${run.snapshot.team.name} · ${node.label}`.slice(0, 160), config: { include_shell_tools: false } });
      const sessionId = sessionIdentifier(created);
      if (!sessionId) throw new Error("Vibe n’a pas retourné d’identifiant de session");
      setSession(sessionId);

      const upstream = Object.entries(upstreamOutputs)
        .map(([key, output]) => `${key}: ${compact(output?.content || JSON.stringify(output), 800)}`)
        .join("\n");
      const prompt = [
        `Objectif global: ${run.objective}`,
        `Rôle: ${node.agent.role}`,
        `Instructions: ${node.agent.instructions}`,
        `Outils autorisés: ${node.agent.tools?.length ? node.agent.tools.join(", ") : "aucun"}`,
        `Policies: filesystem=${node.agent.policy?.filesystem || "deny"}, network=${node.agent.policy?.network || "deny"}, trading=deny`,
        `Tâche de ce worker: ${node.task}`,
        upstream ? `Résultats des dépendances:\n${upstream}` : "Ce worker n’a aucune dépendance.",
        "Réponds avec un résultat vérifiable et cite les artifacts produits.",
      ].join("\n\n").slice(0, 5_000);

      let reader;
      const cancelUpstream = () => {
        void vibe.sessions.cancel(sessionId).catch(() => {});
        void reader?.cancel().catch(() => {});
      };
      signal.addEventListener("abort", cancelUpstream, { once: true });
      try {
        await vibe.sessions.send(sessionId, { content: prompt });
        const response = await vibe.sessions.stream(sessionId, "", "all");
        if (!response.ok || !response.body) throw new Error(`Flux Vibe indisponible (${response.status})`);
        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let content = "";
        let terminal = "";
        let terminalError = "";
        let usage = { tokens: null, costUsd: null };
        while (!terminal) {
          if (signal.aborted) throw new DOMException("Annulé", "AbortError");
          const { done, value } = await reader.read();
          buffer += decoder.decode(value || new Uint8Array(), { stream: !done });
          const frames = buffer.split(/\r?\n\r?\n/);
          buffer = frames.pop() || "";
          for (const raw of frames) {
            const event = parseFrame(raw);
            if (!event.type) continue;
            if (event.type === "text_delta") content += String(event.data.delta || "");
            if (event.type === "llm_usage") usage = usageFrom(event.data, usage);
            if (event.type === "tool_call" && !toolAllowed(event.data.tool || event.data.name, node.agent)) {
              await vibe.sessions.cancel(sessionId).catch(() => {});
              throw new Error(`Policy refusée pour l’outil ${compact(event.data.tool || event.data.name || "inconnu", 120)}`);
            }
            const foundArtifact = artifactFrom(event.type, event.data);
            if (foundArtifact) artifact(foundArtifact);
            if (!["text_delta", "reasoning_delta", "tool_heartbeat"].includes(event.type)) {
              emit({
                type: `vibe.${event.type}`,
                level: event.type.includes("failed") ? "error" : event.type.includes("warning") ? "warning" : "info",
                message: compact(event.data.message || event.data.tool || event.type, 400),
                payload: publicPayload({ upstreamEventId: event.id, ...event.data }),
              });
            }
            if (event.type === "attempt.completed") terminal = "completed";
            if (event.type === "attempt.failed") {
              terminal = "failed";
              terminalError = compact(event.data.error || event.data.message || "Tentative Vibe échouée");
            }
          }
          if (done) break;
        }
        if (terminal === "failed") throw new Error(terminalError);
        if (!content) {
          const messages = await vibe.sessions.messages(sessionId, 250).catch(() => []);
          const list = Array.isArray(messages) ? messages : messages.messages || [];
          content = [...list].reverse().find((message) => message.role === "assistant")?.content || "";
        }
        if (!terminal && !content) throw new Error("Le flux Vibe s’est terminé sans résultat final");
        return { output: { content, sessionId }, tokensUsed: usage.tokens, costUsd: usage.costUsd };
      } finally {
        signal.removeEventListener("abort", cancelUpstream);
        await reader?.cancel().catch(() => {});
      }
    },
  };
}

export function createRunOrchestrator({ store, executor, maxConcurrency = 2 }) {
  const active = new Map();

  async function executeWorker(run, worker, controller) {
    if (!store.startWorker(worker.id)) return;
    const node = run.snapshot.nodes.find((candidate) => candidate.key === worker.nodeKey);
    const current = store.latestRunWorkers(run.id);
    const upstreamOutputs = Object.fromEntries(node.dependsOn.map((key) => {
      const dependency = current.find((candidate) => candidate.nodeKey === key && candidate.status === "completed");
      return [key, dependency?.output || null];
    }));
    const workerController = new AbortController();
    const abortWorker = () => workerController.abort(controller.signal.reason);
    controller.signal.addEventListener("abort", abortWorker, { once: true });
    const timeoutMs = Math.min(node.agent.budget.maxDurationMinutes, run.snapshot.team.budget.maxDurationMinutes) * 60_000;
    const timeout = setTimeout(() => workerController.abort(new Error("Délai worker dépassé")), timeoutMs);
    timeout.unref?.();
    try {
      const result = await executor.execute({
        run,
        worker,
        node,
        upstreamOutputs,
        signal: workerController.signal,
        emit: (event) => store.runEvent({ runId: run.id, workerId: worker.id, ...event }),
        setSession: (sessionId) => store.setWorkerSession(worker.id, sessionId),
        artifact: (value) => store.addRunArtifact({ runId: run.id, workerId: worker.id, ...value }),
      });
      const tokenExceeded = result.tokensUsed != null && result.tokensUsed > node.agent.budget.maxTokens;
      const costExceeded = result.costUsd != null && node.agent.budget.maxCostUsd > 0 && result.costUsd > node.agent.budget.maxCostUsd;
      if (tokenExceeded || costExceeded) {
        store.failWorker(worker.id, tokenExceeded ? "Budget tokens du worker dépassé" : "Budget coût du worker dépassé", "failed", result);
      } else store.completeWorker(worker.id, result);
    } catch (error) {
      const cancelled = controller.signal.aborted || store.getRun(run.id)?.cancelRequestedAt;
      store.failWorker(worker.id, cancelled ? "Annulé par l’opérateur" : error?.message || error, cancelled ? "cancelled" : "failed");
    } finally {
      clearTimeout(timeout);
      controller.signal.removeEventListener("abort", abortWorker);
    }
  }

  async function executeRun(runId, controller) {
    store.startRun(runId);
    const inFlight = new Map();
    try {
      while (true) {
        const run = store.getRun(runId);
        if (!run || ["completed", "failed", "cancelled"].includes(run.status)) return;
        if (controller.signal.aborted || run.cancelRequestedAt) {
          controller.abort();
          await Promise.allSettled([...inFlight.values()]);
          store.finishRun(runId, "cancelled", "Annulé par l’opérateur");
          return;
        }
        const runAge = run.startedAt ? Date.now() - Date.parse(run.startedAt) : 0;
        if (runAge > run.snapshot.team.budget.maxDurationMinutes * 60_000) {
          controller.abort(new Error("Budget de durée du run dépassé"));
          await Promise.allSettled([...inFlight.values()]);
          store.finishRun(runId, "failed", "Budget de durée du run dépassé");
          return;
        }
        if (run.tokensUsed != null && run.tokensUsed > run.snapshot.team.budget.maxTokens) {
          controller.abort(new Error("Budget tokens du run dépassé"));
          await Promise.allSettled([...inFlight.values()]);
          store.finishRun(runId, "failed", "Budget tokens du run dépassé");
          return;
        }
        if (run.costUsd != null && run.snapshot.team.budget.maxCostUsd > 0 && run.costUsd > run.snapshot.team.budget.maxCostUsd) {
          controller.abort(new Error("Budget coût du run dépassé"));
          await Promise.allSettled([...inFlight.values()]);
          store.finishRun(runId, "failed", "Budget coût du run dépassé");
          return;
        }

        let workers = store.latestRunWorkers(runId);
        const failed = workers.filter((worker) => worker.status === "failed");
        for (const worker of failed) {
          const node = run.snapshot.nodes.find((candidate) => candidate.key === worker.nodeKey);
          if (worker.attempt <= (node?.agent?.budget?.maxRetries ?? 0)) store.queueWorkerRetry(worker);
          else {
            controller.abort(new Error("Budget de retries épuisé"));
            await Promise.allSettled([...inFlight.values()]);
            store.finishRun(runId, "failed", `${node?.label || worker.nodeKey} a épuisé son budget de retries`);
            return;
          }
        }
        workers = store.latestRunWorkers(runId);
        if (workers.every((worker) => worker.status === "completed")) {
          store.finishRun(runId, "completed");
          return;
        }

        const completedKeys = new Set(workers.filter((worker) => worker.status === "completed").map((worker) => worker.nodeKey));
        const capacity = Math.min(maxConcurrency, run.maxConcurrency) - inFlight.size;
        const ready = workers.filter((worker) => {
          if (worker.status !== "queued" || inFlight.has(worker.id)) return false;
          const node = run.snapshot.nodes.find((candidate) => candidate.key === worker.nodeKey);
          return node.dependsOn.every((key) => completedKeys.has(key));
        }).slice(0, Math.max(0, capacity));
        for (const worker of ready) {
          const task = executeWorker(run, worker, controller).finally(() => inFlight.delete(worker.id));
          inFlight.set(worker.id, task);
        }
        if (!inFlight.size) {
          store.finishRun(runId, "failed", "Aucun worker exécutable ; DAG bloqué");
          return;
        }
        await Promise.race([...inFlight.values()]);
      }
    } finally {
      await Promise.allSettled([...inFlight.values()]);
      active.delete(runId);
    }
  }

  function start(runId) {
    if (active.has(runId)) return false;
    const run = store.getRun(runId);
    if (!run || !["queued", "degraded"].includes(run.status)) return false;
    const controller = new AbortController();
    const entry = { controller, task: null };
    active.set(runId, entry);
    entry.task = Promise.resolve().then(() => executeRun(runId, controller));
    return true;
  }

  function cancel(runId) {
    const entry = active.get(runId);
    if (entry) entry.controller.abort();
    else store.finishRun(runId, "cancelled", "Annulé avant exécution");
  }

  function recover() {
    const reconciled = store.reconcileStaleRuns();
    for (const run of store.pendingRuns()) start(run.id);
    return reconciled;
  }

  async function shutdown() {
    const entries = [...active.values()];
    for (const entry of entries) entry.controller.abort();
    await Promise.allSettled(entries.map((entry) => entry.task));
  }

  return { start, cancel, recover, shutdown, activeCount: () => active.size };
}
