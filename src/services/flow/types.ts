/**
 * Event types that the flow system can process
 */
export type FlowEvent =
  | { type: "TEXT_MESSAGE"; text: string; userId: string; replyToken: string }
  | {
      type: "IMAGE_MESSAGE";
      imageId: string;
      userId: string;
      replyToken: string;
    }
  | { type: "FOLLOW"; userId: string; replyToken: string };
