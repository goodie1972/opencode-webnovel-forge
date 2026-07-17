export class AgentTimeoutError extends Error {
  constructor(msg?: string) { super(msg ?? 'Agent call timed out'); this.name = 'AgentTimeoutError'; }
}

export class AgentAuthError extends Error {
  constructor(msg?: string) { super(msg ?? 'Authentication failed'); this.name = 'AgentAuthError'; }
}

export class AgentResponseError extends Error {
  constructor(msg?: string) { super(msg ?? 'Invalid response from agent'); this.name = 'AgentResponseError'; }
}
