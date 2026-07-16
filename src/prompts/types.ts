export interface AgentPrompt {
	version: string;
	name: string;
	description: string;
	systemPrompt: string;
}

export interface MasterStyle {
	version: string;
	name: string;
	displayName: string;
	author: string;
	description: string;
	characteristics: string[];
	strengths: string[];
	weaknesses: string[];
	bestFor: string[];
	styleGuide: string;
}
