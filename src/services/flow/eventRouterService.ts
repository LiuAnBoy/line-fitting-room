import ConsoleHandler from "../../utils/consoleHandler";
import { FlowEvent } from "../flowManagerService";

/**
 * @class EventRouterService
 * @description Handles event routing and dispatching logic
 * Extracted from FlowManagerService to follow single responsibility principle
 */
class EventRouterService {
  private static instance: EventRouterService;
  private logger = ConsoleHandler.getInstance("EventRouterService");

  /**
   * Private constructor for the Singleton pattern.
   * Prevents direct instantiation to ensure single instance across application
   * @private
   */
  private constructor() {}

  /**
   * Gets the singleton instance of the EventRouterService.
   * Implements lazy initialization to create instance only when first requested
   * @returns {EventRouterService} The singleton instance
   * @static
   */
  public static getInstance(): EventRouterService {
    if (!EventRouterService.instance) {
      EventRouterService.instance = new EventRouterService();
    }
    return EventRouterService.instance;
  }

  /**
   * Route event to appropriate handler based on event type
   * Uses a strategy pattern to delegate to specific handlers based on event type
   * @param event - The flow event to route
   * @param handlers - Object containing handlers for each event type
   * @param currentState - Current user state for context-aware routing
   * @returns Promise<void>
   * @throws {Error} Re-throws any handler errors after logging
   */
  public async routeEvent(
    event: FlowEvent,
    handlers: {
      handleFollow: (event: FlowEvent & { type: "FOLLOW" }) => Promise<void>;
      handleTextMessage: (
        event: FlowEvent & { type: "TEXT_MESSAGE" },
        currentState: string,
      ) => Promise<void>;
      handleImageMessage: (
        event: FlowEvent & { type: "IMAGE_MESSAGE" },
        currentState: string,
      ) => Promise<void>;
    },
    currentState: string,
  ): Promise<void> {
    try {
      this.logger.log(
        `Routing ${event.type} for user ${event.userId} in state ${currentState}`,
        { color: "blue" },
      );

      switch (event.type) {
        case "FOLLOW":
          await handlers.handleFollow(event);
          break;
        case "TEXT_MESSAGE":
          await handlers.handleTextMessage(event, currentState);
          break;
        case "IMAGE_MESSAGE":
          await handlers.handleImageMessage(event, currentState);
          break;
        default:
          this.logger.log(`Unknown event type: ${(event as FlowEvent).type}`, {
            color: "yellow",
          });
          break;
      }
    } catch (error) {
      this.logger.handleError(error as Error);
      throw error;
    }
  }

  /**
   * Validate event structure and required fields
   * Performs comprehensive validation of event data integrity and type-specific requirements
   * @param event - The event to validate
   * @returns boolean - true if valid, false otherwise
   * @example
   * const isValid = eventRouter.validateEvent({
   *   type: "TEXT_MESSAGE",
   *   userId: "user123",
   *   replyToken: "token456",
   *   text: "Hello"
   * });
   */
  public validateEvent(event: FlowEvent): boolean {
    if (!event || !event.type || !event.userId || !event.replyToken) {
      this.logger.log("Invalid event structure", { color: "red" });
      return false;
    }

    switch (event.type) {
      case "TEXT_MESSAGE":
        if (!(event as FlowEvent & { type: "TEXT_MESSAGE" }).text) {
          this.logger.log("TEXT_MESSAGE missing text field", { color: "red" });
          return false;
        }
        break;
      case "IMAGE_MESSAGE":
        if (!(event as FlowEvent & { type: "IMAGE_MESSAGE" }).imageId) {
          this.logger.log("IMAGE_MESSAGE missing imageId field", {
            color: "red",
          });
          return false;
        }
        break;
    }

    return true;
  }
}

export default EventRouterService;
