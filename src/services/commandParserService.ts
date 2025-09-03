import ConsoleHandler from "../utils/consoleHandler";

/**
 * Command types for the passive flow
 */
export enum PassiveCommand {
  START_FLOW = "START_FLOW",
  CHECK_RESULT = "CHECK_RESULT",
  REGENERATE = "REGENERATE",
  REUPLOAD_CHARACTER = "REUPLOAD_CHARACTER",
  REUPLOAD_CLOTHING = "REUPLOAD_CLOTHING",
  CLEAR_CHARACTER = "CLEAR_CHARACTER",
  CLEAR_CLOTHING = "CLEAR_CLOTHING",
  CLEAR_ALL = "CLEAR_ALL",
  DEV_INIT = "DEV_INIT",
  UNKNOWN = "UNKNOWN",
}

/**
 * Parsed command structure
 */
export type ParsedCommand = {
  type: PassiveCommand;
  originalText: string;
};

/**
 * @class CommandParserService
 * @description Parses text messages into standardized command objects
 */
class CommandParserService {
  private static instance: CommandParserService;
  private logger = ConsoleHandler.getInstance("CommandParserService");

  // Command mapping for passive flow
  private readonly passiveCommandMap = new Map<string, PassiveCommand>([
    // Flow start commands
    ["開始使用", PassiveCommand.START_FLOW],
    ["start", PassiveCommand.START_FLOW],
    ["/start", PassiveCommand.START_FLOW],

    // Result checking
    ["查看結果", PassiveCommand.CHECK_RESULT],
    ["結果", PassiveCommand.CHECK_RESULT],

    // Regeneration and re-upload
    ["重新生成", PassiveCommand.REGENERATE],
    ["重新上傳人物圖片", PassiveCommand.REUPLOAD_CHARACTER],
    ["重新上傳衣物圖片", PassiveCommand.REUPLOAD_CLOTHING],

    // Clear commands
    ["清除人物圖片", PassiveCommand.CLEAR_CHARACTER],
    ["清除衣物圖片", PassiveCommand.CLEAR_CLOTHING],
    ["清除全部", PassiveCommand.CLEAR_ALL],
    ["全部清除", PassiveCommand.CLEAR_ALL],

    // Development commands
    ["/init", PassiveCommand.DEV_INIT],
  ]);

  private constructor() {}

  public static getInstance(): CommandParserService {
    if (!CommandParserService.instance) {
      CommandParserService.instance = new CommandParserService();
    }
    return CommandParserService.instance;
  }

  /**
   * Parse a text message into a command object
   */
  public parseCommand(text: string): ParsedCommand {
    const trimmedText = text.trim();
    const command = this.passiveCommandMap.get(trimmedText);

    const parsedCommand: ParsedCommand = {
      type: command || PassiveCommand.UNKNOWN,
      originalText: trimmedText,
    };

    this.logger.log(
      `Parsed command: "${trimmedText}" -> ${parsedCommand.type}`,
      {
        color: "cyan",
      },
    );

    return parsedCommand;
  }

  /**
   * Check if a text is a recognized command
   */
  public isRecognizedCommand(text: string): boolean {
    return this.passiveCommandMap.has(text.trim());
  }

  /**
   * Get all available commands for debugging
   */
  public getAvailableCommands(): string[] {
    return Array.from(this.passiveCommandMap.keys());
  }
}

export default CommandParserService;
