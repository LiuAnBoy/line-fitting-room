import { messagingApi } from "@line/bot-sdk";

/**
 * @file passiveFlowTemplates.ts
 * @description LINE Bot message templates for passive flow (guided mode)
 */

/**
 * Welcome message for new users with start button
 */
export const welcomeMessage: messagingApi.TextMessage = {
  type: "text",
  text: `🎨 歡迎來到 雜七雜八試衣間 🎨

📸 步驟一：上傳人物圖片
點擊「上傳人物圖片」按鈕，傳送您要合成的人物圖片

👕 步驟二：上傳衣物圖片  
點擊「上傳衣物圖片」按鈕，傳送您要試穿的服裝圖片

✨ 自動合成：
當您上傳完兩張圖片後，系統會自動進行合成處理並回傳結果

🗑️ 管理圖片：
• 清除人物圖片 - 刪除已上傳的人物照片
• 清除衣物圖片 - 刪除已上傳的服裝照片  
• 全部清除 - 清空所有已上傳的圖片

⏰ 注意：
• 圖片會在 30 分鐘後自動清除
• 目前只支援一張人物圖片與一張衣物圖片合成
• 人物照務必清晰，盡量避免陰影和模糊
• 衣物照務必提供單純服裝照片，盡量避免太過複雜`,
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "開始使用",
          text: "開始使用",
        },
      },
    ],
  },
};

/**
 * Request character image upload message
 */
export const requestCharacterMessage: messagingApi.TextMessage = {
  type: "text",
  text: "好的，我們開始吧！請先傳一張您的照片📸",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "camera",
          label: "開啟相機",
        },
      },
      {
        type: "action",
        action: {
          type: "cameraRoll",
          label: "開啟相簿",
        },
      },
    ],
  },
};

/**
 * Character image received, request clothing message
 */
export const requestClothingMessage: messagingApi.TextMessage = {
  type: "text",
  text: "收到人物照囉！接下來，請傳一件想試穿的衣服照片給我👕",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "camera",
          label: "開啟相機",
        },
      },
      {
        type: "action",
        action: {
          type: "cameraRoll",
          label: "開啟相簿",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "清除人物圖片",
          text: "清除人物圖片",
        },
      },
    ],
  },
};

/**
 * Processing message when both images are received
 */
export const processingMessage: messagingApi.TextMessage = {
  type: "text",
  text: "魔法正在發生中...🪄 請稍候片刻，我正在努力為您合成圖片！",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "查看結果",
          text: "查看結果",
        },
      },
    ],
  },
};

/**
 * Still processing message when result is not ready
 */
export const stillProcessingMessage: messagingApi.TextMessage = {
  type: "text",
  text: "別急別急～圖片還在烤箱裡，再等一下下就好囉！🔥",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "查看結果",
          text: "查看結果",
        },
      },
    ],
  },
};

/**
 * Success message when synthesis is complete
 */
export const synthesisCompleteMessage: messagingApi.TextMessage = {
  type: "text",
  text: "噹噹噹！您的專屬試穿照出爐啦！✨",
};

/**
 * Post-synthesis options message
 */
export const postSynthesisOptionsMessage: messagingApi.TextMessage = {
  type: "text",
  text: "看看結果如何？您可以選擇...",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "重新生成",
          text: "重新生成",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "重新上傳人物圖片",
          text: "重新上傳人物圖片",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "重新上傳衣物圖片",
          text: "重新上傳衣物圖片",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "清除全部",
          text: "清除全部",
        },
      },
    ],
  },
};

/**
 * Multi-image warning message
 */
export const multiImageWarningMessage: messagingApi.TextMessage = {
  type: "text",
  text: "哎呀，您一次傳了好多張照片！我先拿第一張來處理囉😉",
};

/**
 * Character image cleared confirmation
 */
export const characterClearedMessage: messagingApi.TextMessage = {
  type: "text",
  text: "OK！人物照片已經幫您清掉囉！",
};

/**
 * Clothing image cleared confirmation
 */
export const clothingClearedMessage: messagingApi.TextMessage = {
  type: "text",
  text: "好的！衣物照片已經成功清除！",
};

/**
 * All images cleared confirmation
 */
export const allClearedMessage: messagingApi.TextMessage = {
  type: "text",
  text: "全部清空空！我們又可以重新開始囉！🧹",
};

/**
 * Generic error message
 */
export const createErrorMessage = (
  message?: string,
): messagingApi.TextMessage => ({
  type: "text",
  text: message || "糟糕！好像有地方出錯了，請稍後再試一次看看？",
});

/**
 * Synthesis result image message with options
 */
export const createSynthesisResultImageMessage = (
  generatedImageUrl: string,
): messagingApi.ImageMessage => ({
  type: "image",
  originalContentUrl: generatedImageUrl,
  previewImageUrl: generatedImageUrl,
});

/**
 * Request to re-upload character image
 */
export const requestReUploadCharacterMessage: messagingApi.TextMessage = {
  type: "text",
  text: "換張主角照片試試？請上傳新的人物圖片！🧑‍🎨",
  quickReply: {
    items: [
      { type: "action", action: { type: "camera", label: "開啟相機" } },
      { type: "action", action: { type: "cameraRoll", label: "開啟相簿" } },
    ],
  },
};

/**
 * Request to re-upload clothing image
 */
export const requestReUploadClothingMessage: messagingApi.TextMessage = {
  type: "text",
  text: "換件新衣服吧！請上傳新的衣物圖片！👚",
  quickReply: {
    items: [
      { type: "action", action: { type: "camera", label: "開啟相機" } },
      { type: "action", action: { type: "cameraRoll", label: "開啟相簿" } },
    ],
  },
};
