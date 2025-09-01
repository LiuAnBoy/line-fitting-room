/**
 * @file Extends the Express Request interface to include a custom rawBody property.
 * This is used to store the raw, unparsed request body for webhook signature validation.
 */

declare global {
  namespace Express {
    interface Request {
      // The raw, unparsed request body as a string.
      rawBody?: string;
    }
  }
}

// This export is required to make the file a module and allow the global declaration.
export {};