export interface ModelPresetEntry {
	model: string;
	temperature: number;
}

export const DEFAULT_MODELS: Record<string, string> = {
	editor_in_chief: 'anthropic/claude-sonnet-4-5',
	research_market: 'google/gemini-2.0-flash',
	research_deep: 'anthropic/claude-sonnet-4-5',
	writer_a: 'anthropic/claude-sonnet-4-5',
	writer_b: 'anthropic/claude-sonnet-4-5',
	writer_c: 'anthropic/claude-sonnet-4-5',
	world_builder: 'openai/gpt-4o',
	character_designer: 'openai/gpt-4o',
	plot_architect: 'anthropic/claude-sonnet-4-5',
	shuang_analyzer: 'google/gemini-2.0-flash',
	pacing_reviewer: 'google/gemini-2.0-flash',
	genre_checker: 'openai/gpt-4o',
	reader_simulator: 'anthropic/claude-sonnet-4-5',
	copy_editor: 'anthropic/claude-sonnet-4-5',
	default: 'inherit',
};

export type Language = 'zh' | 'en';

export const MAX_FILE_SIZE = 10_485_760;
export const MAX_DIRECTORY_DEPTH = 10;
