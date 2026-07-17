const policies = Object.freeze({
  "chat.plan": { risk: "A", allowed: true, confirmation: false },
  "chat.build": { risk: "B", allowed: true, confirmation: false },
  "database.backup": { risk: "B", allowed: true, confirmation: false },
  "session.revoke": { risk: "A", allowed: true, confirmation: false },
  "agents.write": { risk: "B", allowed: true, confirmation: false },
  "teams.write": { risk: "B", allowed: true, confirmation: false },
  "runs.start": { risk: "B", allowed: true, confirmation: false },
  "runs.cancel": { risk: "B", allowed: true, confirmation: false },
  "runs.retry": { risk: "B", allowed: true, confirmation: false },
  "files.write": { risk: "B", allowed: true, confirmation: false },
  "files.restore": { risk: "B", allowed: true, confirmation: false },
  "artifacts.index": { risk: "A", allowed: true, confirmation: false },
  "memory.write": { risk: "B", allowed: true, confirmation: false },
  "hypotheses.write": { risk: "B", allowed: true, confirmation: false },
  "service.control": { risk: "C", allowed: false, confirmation: true },
  "trading.live": { risk: "D", allowed: false, confirmation: true },
});

export class PolicyError extends Error {
  constructor(action) {
    super(`Action not authorized in this phase: ${action}`);
    this.name = "PolicyError";
    this.code = "policy_denied";
  }
}

export function policyFor(action) {
  return policies[action] || { risk: "C", allowed: false, confirmation: true };
}

export function assertAllowed(action) {
  const policy = policyFor(action);
  if (!policy.allowed) throw new PolicyError(action);
  return policy;
}
