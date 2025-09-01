import express, { Application } from "express";
import http from "http";
import path from "path";

import ConfigService from "../services/configService";
import ConsoleHandler from "../utils/consoleHandler";
import LineProvider from "./line";
import Routes from "./routes";

/**
 * @class Express
 * @description A wrapper class for the Express application.
 * Handles initialization, mounting of routes and middleware, and graceful shutdown.
 */
class Express {
  public express: Application;
  public server: http.Server | null;
  private logger: ConsoleHandler;
  private activeConnections: { [key: string]: any } = {};

  /**
   * @constructor
   */
  constructor() {
    this.express = express();
    this.server = null;
    this.logger = ConsoleHandler.getInstance("Express");
  }

  /**
   * Mounts configuration-related middleware.
   * @private
   */
  private mountConfig(): void {
    const config = ConfigService.getInstance();
    this.express = config.init(this.express);
  }

  /**
   * Mounts LINE provider-related middleware.
   * @private
   */
  private mountLine(): void {
    const lineProvider = LineProvider.getInstance();
    this.express = lineProvider.init(this.express);
  }

  /**
   * Mounts application routes.
   * @private
   */
  private mountRoutes(): void {
    this.express = Routes.init(this.express);
  }

  /**
   * Mounts the static file server for serving images.
   * @private
   */
  private mountStaticFiles(): void {
    // Serve static files from the 'images' directory under the /images route.
    const imagesPath = path.join(process.cwd(), "images");
    this.express.use("/images", express.static(imagesPath));
    this.logger.log(`Static files mounted at /images -> ${imagesPath}`);
  }

  /**
   * Initializes all the required services and mounts them to the Express app.
   * @private
   */
  private async initServices(): Promise<void> {
    this.logger.log("Starting application initialization...");

    try {
      this.mountConfig();
      this.mountLine();
      this.mountStaticFiles();
      this.mountRoutes();

      this.logger.log("Application initialization completed successfully");
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error("FATAL: Failed to initialize application:", error);
      } else {
        this.logger.error(
          "FATAL: Failed to initialize application with unknown error:",
          new Error(String(error)),
        );
      }

      process.exit(1);
    }
  }

  /**
   * Initializes the Express application.
   * @returns {Promise<Application>} The initialized Express application.
   */
  public async init(): Promise<Application> {
    await this.initServices();
    return this.express;
  }

  /**
   * Starts the HTTP server.
   * @returns {Promise<void>}
   */
  public start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const port = ConfigService.getInstance().getConfig().PORT;

        this.server = this.express.listen(port, () => {
          this.logger.log(`Running SERVER @ http://localhost:${port}`);
          resolve();
        });

        this.server.on("error", (error) => {
          this.logger.error("Server startup error:", error);
          reject(error);
        });

        // Handle HTTP keep-alive connections.
        this.server.keepAliveTimeout = 65000;
        this.server.headersTimeout = 66000;

        // Listen for connection events to track active connections for graceful shutdown.
        if (this.server) {
          this.server.on("connection", (socket) => {
            const socketId = `${socket.remoteAddress}:${socket.remotePort}`;
            this.activeConnections[socketId] = socket;
            socket.on("close", () => {
              delete this.activeConnections[socketId];
            });
          });
        }
      } catch (error) {
        this.logger.error("Failed to start server:", error as Error);
        reject(error);
      }
    });
  }

  /**
   * Performs a graceful shutdown of the server.
   * @returns {Promise<void>}
   */
  public async shutdown(): Promise<void> {
    this.logger.log("Initiating graceful shutdown...", { color: "yellow" });

    await new Promise<void>((resolve, reject) => {
      if (!this.server) {
        this.logger.warn("Server instance not found, skipping server close.");
        resolve();
        return;
      }
      this.server.close((err) => {
        if (err) {
          this.logger.error("Error during server close:", err);
          reject(err);
        } else {
          this.logger.log("HTTP server stopped accepting new connections.", {
            color: "yellow",
          });
          this.server = null;
          resolve();
        }
      });

      this.logger.log(
        `Closing ${Object.keys(this.activeConnections).length} active connections...`,
        { color: "yellow" },
      );
      Object.values(this.activeConnections).forEach((socket: any) => {
        socket.destroy();
      });
      this.activeConnections = {};

      // Set a timeout to prevent the shutdown process from getting stuck.
      const shutdownTimeout = setTimeout(() => {
        this.logger.error("Shutdown timed out, forcing exit.");
        reject(new Error("Server shutdown timeout"));
      }, 15000); // 15-second timeout

      // Clear the timeout timer if the close completes normally.
      this.server?.on("close", () => {
        clearTimeout(shutdownTimeout);
      });
    });

    this.logger.log("Graceful shutdown completed.", { color: "green" });
  }
}

export default new Express();
