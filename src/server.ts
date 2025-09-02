import Express from "./providers/express";
import ConsoleHandler from "./utils/consoleHandler";

/**
 * @class Server
 * @description The main server class that starts the application and handles graceful shutdown.
 */
class Server {
  private static logger = ConsoleHandler.getInstance("Server");

  /**
   * Performs a graceful shutdown of the application.
   * @param {string} signal - The shutdown signal received.
   * @private
   */
  private static async gracefulShutdown(signal: string): Promise<void> {
    this.logger.log(`${signal} received. Starting graceful shutdown...`, {
      color: "yellow",
    });

    try {
      await Express.shutdown();
      this.logger.log("Server closed.", { color: "yellow" });

      this.logger.log("Graceful shutdown completed.", { color: "green" });
      process.exit(0);
    } catch (error) {
      this.logger.handleError(error as Error);
      process.exit(1);
    }
  }

  /**
   * Registers handlers for process signals to ensure graceful shutdown.
   * @private
   */
  private static registerShutdownHandlers(): void {
    ["SIGTERM", "SIGINT", "SIGUSR2"].forEach((signal) => {
      process.on(signal, () => this.gracefulShutdown(signal));
    });

    process.on("unhandledRejection", (reason) => {
      this.logger.handleError(reason as Error);
      this.gracefulShutdown("UNHANDLED_REJECTION");
    });

    process.on("uncaughtException", (error) => {
      this.logger.handleError(error);
      this.gracefulShutdown("UNCAUGHT_EXCEPTION");
    });
  }

  /**
   * Starts the application server.
   * @public
   */
  public static async start(): Promise<void> {
    try {
      this.registerShutdownHandlers();

      await Express.init();

      await Express.start();

      this.logger.log("Server started", { color: "green" });
    } catch (error) {
      this.logger.error("Failed to start server:", error as Error);
      process.exit(1);
    }
  }
}

Server.start();
