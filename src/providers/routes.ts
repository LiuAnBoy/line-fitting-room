import { Application } from "express";

import lineController from "../controllers/lineController";
import ConsoleHandler from "../utils/consoleHandler";

/**
 * @class Routes
 * @description Mounts all application routes to the Express app.
 */
class Routes {
  private logger = ConsoleHandler.getInstance("Routes");

  /**
   * Initializes and mounts the routes.
   * @param {Application} _express - The Express application instance.
   * @returns {Application} The Express application with routes mounted.
   */
  public init(_express: Application): Application {
    // General health check endpoint.
    _express.get("/health", (req, res) => {
      res.json({ status: "OK", service: "LINE Fitting Room" });
    });

    // LINE Bot specific routes.
    _express.post("/webhook", lineController.webhook);
    _express.get("/line/health", lineController.health);

    this.logger.log("Routes mounted", { color: "green" });
    return _express;
  }
}

export default new Routes();
