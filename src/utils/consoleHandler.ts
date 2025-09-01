import dayjs from "dayjs";
import fs from "fs";
import path from "path";

// Define foreground color types for log method customization
export type LogColor =
  | "black"
  | "red"
  | "green"
  | "yellow"
  | "blue"
  | "magenta"
  | "cyan"
  | "white"
  | "blackBright";

// Define background color types for log method customization
export type LogBgColor =
  | "bgBlack"
  | "bgRed"
  | "bgGreen"
  | "bgYellow"
  | "bgBlue"
  | "bgMagenta"
  | "bgCyan"
  | "bgWhite"
  | "bgBlackBright";

// Options interface for log method color customization
export interface LogOptions {
  color?: LogColor;
  background?: LogBgColor;
}

/**
 * @interface IConsoleHandler
 * @description Defines the methods that a ConsoleHandler must implement.
 */
interface IConsoleHandler {
  log(message: string, options?: LogOptions): Promise<void>;
  warn(message: string): Promise<void>;
  error(message: string, error?: Error): Promise<void>;
  handleError(error: Error): Promise<void>;
}

/**
 * @class ConsoleHandler
 * @implements IConsoleHandler
 * @description Provides a logging handler with module name identification, color output,
 * in-memory history, and functionality to write errors to separate files
 * in the production environment.
 * Uses the Singleton pattern to ensure only one handler instance per module name.
 */
class ConsoleHandler implements IConsoleHandler {
  // A map to store singleton ConsoleHandler instances for each module name.
  private static instances: Map<string, ConsoleHandler> = new Map();
  // A flag to track if the log directory has been successfully ensured or created, preventing redundant checks.
  private logDirEnsured: boolean = false;
  // An in-memory array storing the log history.
  private logHistory: string[] = [];
  // Chalk instance for colored output, dynamically imported for ESM compatibility.
  private chalk: typeof import("chalk").default | null = null;

  // The current Node.js environment ('development', 'production', etc.).
  private readonly nodeEnv: string;
  // The maximum number of log history entries to keep in memory.
  private readonly MAX_HISTORY = 100;
  // The fixed width for the module name in formatted output, used for alignment.
  private readonly MAX_NAME_LENGTH = 18;
  // The absolute directory path where error log files will be stored.
  private logDirectory: string;
  // The number of preceding log entries to include as context when writing an error file.
  private readonly LOG_CONTEXT_COUNT = 10;

  /**
   * Private constructor to ensure instances are only created via getInstance.
   * Determines the runtime environment and log directory upon initialization.
   * @private
   * @constructor
   * @param {string} moduleName - The name of the module associated with this logger instance.
   */
  private constructor(private readonly moduleName: string) {
    // Read environment variable directly; defaults to 'development' if not set.
    // This is more reliable early on than depending on ConfigService.
    this.nodeEnv = process.env.NODE_ENV || "development";
    // Set the log directory to the 'logs' folder in the project root.
    this.logDirectory = path.resolve(process.cwd(), "logs");
    // Initialize chalk instance asynchronously.
    this.initializeChalk();
  }

  /**
   * Initializes the chalk instance using dynamic import for ESM compatibility.
   * @private
   */
  private async initializeChalk(): Promise<void> {
    try {
      const chalkModule = await import("chalk");
      this.chalk = chalkModule.default;
    } catch (error) {
      console.warn(
        "Failed to load chalk module, falling back to no colors",
        error,
      );
      this.chalk = null;
    }
  }

  /**
   * Returns the chalk instance, ensuring it's initialized.
   * @private
   * @returns {Promise<any>} The chalk instance.
   */
  private async getChalk() {
    if (!this.chalk) {
      await this.initializeChalk();
    }
    return this.chalk;
  }

  /**
   * Gets the singleton ConsoleHandler instance for a given module name.
   * Creates one if it doesn't exist yet.
   * @static
   * @param {string} moduleName - The name of the module needing a logger instance.
   * @returns {ConsoleHandler} The singleton ConsoleHandler instance for the specified module name.
   * @throws {Error} If moduleName is empty.
   */
  public static getInstance(moduleName: string): ConsoleHandler {
    if (!moduleName) throw new Error("Module name cannot be empty");
    if (!this.instances.has(moduleName)) {
      this.instances.set(moduleName, new ConsoleHandler(moduleName));
    }
    return this.instances.get(moduleName)!;
  }

  /**
   * Pads the module name to a fixed width and adds it as a prefix to the message.
   * @private
   * @param {string} message - The original log message.
   * @returns {string} The formatted message, prefixed with the padded module name.
   */
  private formatMessage(message: string): string {
    const modulePadded = this.moduleName.padEnd(this.MAX_NAME_LENGTH, " ");
    return `${modulePadded}:: ${message}`;
  }

  /**
   * Logs a general information message (INFO level) with customizable colors.
   * Outputs to console and adds to history.
   * @public
   * @param {string} message - The message to log.
   * @param {LogOptions} [options={}] - Optional color customization options.
   */
  async log(message: string, options: LogOptions = {}): Promise<void> {
    const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const formattedMessage = this.formatMessage(message);
    const levelPadded = `[INFO ]`;
    const fullMessage = `[${timestamp}] ${levelPadded} ${formattedMessage}`;

    const chalk = await this.getChalk();

    if (chalk) {
      let chalkChain = chalk;

      const defaultFgColor: LogColor = "blackBright";
      const fgColor = options.color || defaultFgColor;
      if (fgColor && typeof chalkChain[fgColor] === "function") {
        chalkChain = chalkChain[fgColor];
      }

      if (
        options.background &&
        typeof chalkChain[options.background] === "function"
      ) {
        chalkChain = chalkChain[options.background];
      }

      console.log(chalkChain(fullMessage));
    } else {
      console.log("\x1b[32m%s\x1b[0m", fullMessage);
    }

    this.addToHistory(fullMessage);
  }

  /**
   * Logs a warning message (WARN level) with fixed yellow color.
   * Outputs to console and adds to history.
   * @public
   * @param {string} message - The warning message to log.
   */
  async warn(message: string): Promise<void> {
    const timestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");
    const formattedMessage = this.formatMessage(message);
    const levelPadded = `[WARN ]`;
    const fullMessage = `[${timestamp}] ${levelPadded} ${formattedMessage}`;

    const chalk = await this.getChalk();

    if (chalk) {
      console.warn(chalk.yellow(fullMessage));
    } else {
      console.warn("\x1b[33m%s\x1b[0m", fullMessage);
    }

    this.addToHistory(fullMessage);
  }

  /**
   * Logs an error message (ERROR level) with fixed red color. Outputs to console, adds to history,
   * and, in the production environment, writes the error information (including context)
   * to a separate log file.
   * @public
   * @param {string} message - The primary error message.
   * @param {Error} [error] - Optional original Error object for logging the stack trace.
   */
  async error(message: string, error?: Error): Promise<void> {
    const preciseTimestamp = dayjs().format("YYYYMMDD_HHmmss");
    const logTimestamp = dayjs().format("YYYY-MM-DD HH:mm:ss");

    const formattedMessage = this.formatMessage(message);
    const fullMessage = `[ERROR]${formattedMessage} [${logTimestamp}]`;

    const historyContext = this.logHistory.slice(-this.LOG_CONTEXT_COUNT);

    const chalk = await this.getChalk();

    if (chalk) {
      console.error(chalk.red(fullMessage));
    } else {
      console.error("\x1b[31m%s\x1b[0m", fullMessage);
    }
    this.addToHistory(fullMessage);

    let stackTrace = "";
    let stackTraceForFile = "";
    if (error?.stack) {
      stackTrace = `[STACK] ${error.stack} [${logTimestamp}]`;
      stackTraceForFile = `[STACK] ${error.stack}`;

      if (chalk) {
        console.error(chalk.red(stackTrace));
      } else {
        console.error("\x1b[31m%s\x1b[0m", stackTrace);
      }
      this.addToHistory(stackTrace);
    }

    if (this.nodeEnv === "production") {
      this.ensureLogDirectoryExists();

      if (this.logDirEnsured) {
        const filename = `error-${preciseTimestamp}.log`;
        const errorFilePath = path.join(this.logDirectory, filename);

        const contextHeader = `--- Error Context (Last ${historyContext.length} logs) START ---`;
        const contextFooter = `--- Error Context END ---`;
        const contextLog = historyContext.join("\n");
        const logEntry = `${contextHeader}\n${contextLog}\n${fullMessage}\n${stackTraceForFile ? stackTraceForFile + "\n" : ""}${contextFooter}\n`;

        try {
          fs.writeFileSync(errorFilePath, logEntry, { encoding: "utf8" });
        } catch (fileError) {
          const fileErrorMsg = `[ERROR] Failed to write error context to log file: ${errorFilePath}`;
          if (chalk) {
            console.error(chalk.red(fileErrorMsg), fileError);
          } else {
            console.error("\x1b[31m%s\x1b[0m", fileErrorMsg, fileError);
          }
        }
      }
    }
  }

  /**
   * Handles a caught Error object, formats a user-friendly message,
   * and calls the error method for logging.
   * @public
   * @param {Error} error - The caught Error object.
   */
  async handleError(error: Error): Promise<void> {
    const errorMessage = `Error caught: ${error.name} - ${error.message}`;
    await this.error(errorMessage, error);
  }

  /**
   * Adds the formatted log message to the in-memory history,
   * maintaining the maximum history size.
   * @private
   * @param {string} message - The complete log message to add to history.
   */
  private addToHistory(message: string): void {
    this.logHistory.push(message);
    if (this.logHistory.length > this.MAX_HISTORY) {
      this.logHistory.shift();
    }
  }

  /**
   * Returns a copy of the current in-memory log history.
   * @public
   * @returns {string[]} A copy of the current in-memory log history.
   */
  getHistory(): string[] {
    return [...this.logHistory];
  }

  /**
   * Clears the in-memory log history.
   * @public
   */
  clearHistory(): void {
    this.logHistory = [];
  }

  /**
   * Ensures the log directory exists. If not, attempts to create it.
   * Executes only once in the production environment when logging to a file is first needed.
   * @private
   */
  private ensureLogDirectoryExists(): void {
    if (this.nodeEnv === "production" && !this.logDirEnsured) {
      try {
        if (!fs.existsSync(this.logDirectory)) {
          fs.mkdirSync(this.logDirectory, { recursive: true });
          console.log(`[INFO ] Log directory created: ${this.logDirectory}`);
        }
        this.logDirEnsured = true;
      } catch (dirError) {
        const dirErrorMsg = `[ERROR] Failed to create log directory: ${this.logDirectory}`;
        console.error("\x1b[31m%s\x1b[0m", dirErrorMsg, dirError);
      }
    }
  }

  /**
   * Returns a list of module names for all created ConsoleHandler instances.
   * @static
   * @returns {string[]} A list of module names.
   */
  static getAllModuleNames(): string[] {
    return Array.from(this.instances.keys());
  }

  /**
   * Retrieves the ConsoleHandler instance for a specific module.
   * @static
   * @param {string} moduleName - The module name to look up.
   * @returns {ConsoleHandler | undefined} The corresponding instance, or undefined if not found.
   */
  static getModuleInstance(moduleName: string): ConsoleHandler | undefined {
    return this.instances.get(moduleName);
  }
}

export default ConsoleHandler;
