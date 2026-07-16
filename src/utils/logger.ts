function isDebugEnabled(): boolean {
	return process.env.OPENCODE_WEBNOVEL_FORGE_DEBUG === '1';
}

export function log(message: string, data?: unknown): void {
	if (!isDebugEnabled()) return;

	const timestamp = new Date().toISOString();
	if (data !== undefined) {
		console.log(`[opencode-webnovel-forge ${timestamp}] ${message}`, data);
	} else {
		console.log(`[opencode-webnovel-forge ${timestamp}] ${message}`);
	}
}

export function warn(message: string, data?: unknown): void {
	const timestamp = new Date().toISOString();
	if (data !== undefined) {
		console.warn(`[opencode-webnovel-forge ${timestamp}] WARN: ${message}`, data);
	} else {
		console.warn(`[opencode-webnovel-forge ${timestamp}] WARN: ${message}`);
	}
}

export function error(message: string, data?: unknown): void {
	const timestamp = new Date().toISOString();
	if (data !== undefined) {
		console.error(`[opencode-webnovel-forge ${timestamp}] ERROR: ${message}`, data);
	} else {
		console.error(`[opencode-webnovel-forge ${timestamp}] ERROR: ${message}`);
	}
}

