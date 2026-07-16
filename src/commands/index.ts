import { handleDiagnoseCommand } from './diagnose';
import { handleExportCommand } from './export';
import { handleResetCommand } from './reset';
import { handleNovelCommand } from './novel';

const SWARM_HELP = `Available /swarm commands:

  /swarm diagnose  - Run diagnostics on the swarm configuration and state
  /swarm export    - Export swarm data and evidence
  /swarm reset     - Reset swarm state (requires --confirm)

Use --confirm flag with reset to proceed:
  /swarm reset --confirm`;

const NOVEL_HELP = '`/novel model` — 查看/配置 agent LLM 模型';

export interface CommandInput {
	command: string;
	args?: string[];
}

export interface TextPart {
	type: 'text';
	text: string;
}

export interface CommandOutput {
	parts: TextPart[];
}

export interface SwarmCommandHandler {
	(input: CommandInput, output: CommandOutput): Promise<void>;
}

export function createSwarmCommandHandler(directory: string): SwarmCommandHandler {
	return async (input: CommandInput, output: CommandOutput): Promise<void> => {
		const args = input.args ?? [];
		const subcommand = args[0]?.toLowerCase();
		const cmd = input.command.toLowerCase();

		if (cmd === 'novel') {
			const result = await handleNovelCommand(args, directory);
			output.parts = [{ type: 'text', text: result }];
			return;
		}

		// Legacy /swarm commands
		switch (subcommand) {
			case 'diagnose': {
				const result = await handleDiagnoseCommand(directory, args.slice(1));
				output.parts = [{ type: 'text', text: result }];
				break;
			}
			case 'export': {
				const result = await handleExportCommand(directory, args.slice(1));
				output.parts = [{ type: 'text', text: result }];
				break;
			}
			case 'reset': {
				const result = await handleResetCommand(directory, args.slice(1));
				output.parts = [{ type: 'text', text: result }];
				break;
			}
			default: {
				output.parts = [{ type: 'text', text: SWARM_HELP }];
			}
		}
	};
}

export { handleDiagnoseCommand, handleExportCommand, handleResetCommand, handleNovelCommand };
