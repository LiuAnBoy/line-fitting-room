import { messagingApi } from "@line/bot-sdk";

import {
  afterFirstUploadReply,
  afterSynthesisReply,
  allCommandReply,
  cameraReply,
  clearAllReply,
  getImageStatusReply,
  helpReply,
  imageTypeReply,
  restartReply,
  retryReply,
  startAgainReply,
  tryAgainReply,
  updateCharacterReply,
  updateClothingReply,
  uploadCharacterReply,
  uploadClothingReply,
} from "./basic";

// Welcome Message
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
• 衣物照務必提供單純服裝照片，盡量避免太過複雜
`,
  quickReply: {
    items: [...uploadCharacterReply, ...uploadClothingReply, ...helpReply],
  },
};

// Command Menu Message
export const commandReply: messagingApi.TextMessage = {
  type: "text",
  text: "請選擇以下操作：",
  quickReply: {
    items: allCommandReply,
  },
};

// Help Message
export const helpMessage: messagingApi.TextMessage = {
  type: "text",
  text: `🎨 歡迎來到 雜七雜八試衣間 🎨
  
📸 步驟一：上傳人物圖片
點擊「上傳人物圖片」按鈕，傳送您要合成的人物照片

👕 步驟二：上傳衣物圖片  
點擊「上傳衣物圖片」按鈕，傳送您要試穿的服裝照片

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
• 衣物照務必提供單純服裝照片，盡量避免太過複雜
`,

  quickReply: {
    items: [...uploadCharacterReply, ...uploadClothingReply, ...helpReply],
  },
};

// Character Image Cleared Confirmation Message
export const characterImageClearedMessage: messagingApi.TextMessage = {
  type: "text",
  text: "✅ 人物圖片已清除",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "重新上傳人物圖片",
          text: "/上傳人物圖片",
        },
      },
    ],
  },
};

// Clothing Image Cleared Confirmation Message
export const clothingImageClearedMessage: messagingApi.TextMessage = {
  type: "text",
  text: "✅ 衣物圖片已清除",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "重新上傳衣物圖片",
          text: "/上傳衣物圖片",
        },
      },
    ],
  },
};

// All Cleared Confirmation Message
export const allClearedMessage: messagingApi.TextMessage = {
  type: "text",
  text: "✅ 所有圖片已清除",
  quickReply: {
    items: restartReply,
  },
};

// Processing Message
export const processingMessage: messagingApi.TextMessage = {
  type: "text",
  text: "🎨 合成圖片中，請稍候... ⏳\n\n這可能需要幾秒鐘的時間，您可以點擊下方按鈕查看結果！",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "查看結果",
          text: "/查看結果",
        },
      },
    ],
  },
};

// Message prompting user to upload a character image
export const waitingForCharacterMessage: messagingApi.TextMessage = {
  type: "text",
  text: "📸 請上傳人物圖片",
  quickReply: {
    items: cameraReply,
  },
};

// Message prompting user to upload a clothing image
export const waitingForClothingMessage: messagingApi.TextMessage = {
  type: "text",
  text: "👕 請上傳衣物圖片",
  quickReply: {
    items: cameraReply,
  },
};

/**
 * Creates a confirmation message after an image has been received.
 * Displays different quick reply options based on the type of image uploaded.
 * @param type - The type of image received ('character' or 'clothing').
 * @returns A LINE text message object.
 */
export const createImageReceivedMessage = (
  type: "character" | "clothing",
): messagingApi.TextMessage => {
  const typeText = type === "character" ? "人物" : "衣物";
  const emoji = type === "character" ? "📸" : "👕";

  return {
    type: "text",
    text: `${emoji} ${typeText}圖片已接收！`,
    quickReply: {
      items: afterFirstUploadReply(type),
    },
  };
};

/**
 * Creates a message to ask the user for the type of the uploaded image.
 * @returns A LINE text message object with quick replies for 'character' or 'clothing'.
 */
export const createImageTypeInquiryMessage = (): messagingApi.TextMessage => {
  return {
    type: "text",
    text: "📷 請問這是人物圖片還是衣物圖片？",
    quickReply: {
      items: imageTypeReply,
    },
  };
};

/**
 * Creates a message to ask the user if they want to update the existing clothing image.
 * @returns A LINE text message object with quick replies for confirmation.
 */
export const createUpdateClothingInquiryMessage =
  (): messagingApi.TextMessage => {
    return {
      type: "text",
      text: "👕 目前已有衣物圖片，是否要更新？",
      quickReply: {
        items: updateClothingReply,
      },
    };
  };

/**
 * Creates a message to ask the user if they want to update the existing character image.
 * @returns A LINE text message object with quick replies for confirmation.
 */
export const createUpdateCharacterInquiryMessage =
  (): messagingApi.TextMessage => {
    return {
      type: "text",
      text: "👤 目前已有人物圖片，是否要更新？",
      quickReply: {
        items: updateCharacterReply,
      },
    };
  };

/**
 * Creates a generic error message.
 * @param message - An optional custom error message text.
 * @returns A LINE text message object with retry options.
 */
export const createErrorMessage = (
  message: string = "處理過程中發生錯誤，請稍後再試",
): messagingApi.TextMessage => {
  return {
    type: "text",
    text: `❌ ${message}`,
    quickReply: {
      items: retryReply,
    },
  };
};

/**
 * Creates a dynamic status message with quick replies based on the user's current image status.
 * @param hasCharacter - Whether the user has a character image.\n * @param hasClothing - Whether the user has a clothing image.\n * @param message - An optional introductory message text.\n * @returns A LINE text message object with dynamic quick replies.
 */
export const createImageStatusMessage = (
  hasCharacter: boolean,
  hasClothing: boolean,
  message: string = "請選擇您要進行的操作：",
): messagingApi.TextMessage => {
  return {
    type: "text",
    text: "請選擇您要進行的操作：",
    quickReply: {
      items: afterSynthesisReply,
    },
  };
};

/**
 * Creates a menu message to be shown after a synthesis is complete.
 * @returns A LINE text message object with various options.
 */
export const createAfterSynthesisMenuMessage = (): messagingApi.TextMessage => {
  return {
    type: "text",
    text: `🎉 請選擇您要進行的操作：\n\n1️⃣ 瀏覽現有圖片 - 查看目前已上傳的圖片\n2️⃣ 上傳人物照片 - 更換人物後可繼續上傳衣物\n3️⃣ 上傳衣物照片 - 直接生成新的合成圖片  \n4️⃣ 清除人物照片 - 保留衣物圖片\n5️⃣ 清除衣物照片 - 保留人物圖片\n6️⃣ 全部清除 - 重新開始使用`,
    quickReply: {
      items: afterSynthesisReply,
    },
  };
};

/**
 * Creates a message to show the synthesis result.
 * @param characterId - The ID of the character image.
 * @param clothingId - The ID of the clothing image.
 * @returns A LINE text message object with result details.
 */
export const createSynthesisResultMessage = (
  characterId: string,
  clothingId: string,
): messagingApi.TextMessage => {
  return {
    type: "text",
    text: `✨ 合成完成！\n\n人物圖片ID: ${characterId}\n衣物圖片ID: ${clothingId}\n\n（實際合成圖片將在 API 整合後顯示）`,
    quickReply: {
      items: [...tryAgainReply, ...clearAllReply],
    },
  };
};

/**
 * Creates a Flex Message to browse existing images.\n * @param characterUrl - The URL of the character image, or null.\n * @param clothingUrl - The URL of the clothing image, or null.\n * @param generatedUrl - The URL of the generated image, or null.\n * @returns A LINE Flex Message object.
 */
export const createBrowseImagesMessage = (
  characterUrl: string | null,
  clothingUrl: string | null,
  generatedUrl: string | null = null,
): messagingApi.FlexMessage => {
  const bubbles: any[] = [];

  // Generated image bubble (first position if exists)
  if (generatedUrl) {
    const generatedBubble = {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "text",
            text: "✨ 合成圖片",
            weight: "bold",
            size: "lg",
            margin: "md",
            color: "#333333",
          },
          {
            type: "image",
            url: generatedUrl,
            size: "full",
            aspectMode: "fit",
            margin: "md",
          },
        ],
        paddingAll: "20px",
      },
      footer: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          {
            type: "button",
            action: {
              type: "message",
              label: "重新生成",
              text: "/合成圖片",
            },
            style: "primary",
            color: "#FF6B6B",
          },
          {
            type: "button",
            action: {
              type: "message",
              label: "下載圖片",
              text: "/下載圖片",
            },
            style: "secondary",
          },
        ],
      },
    };
    bubbles.push(generatedBubble);
  }

  // Character image bubble
  const characterButtons: any[] = [
    {
      type: "button",
      action: {
        type: "message",
        label: "上傳",
        text: "/上傳人物圖片",
      },
      style: "primary",
      color: "#1DB446",
    },
  ];

  // Add clear button if image exists
  if (characterUrl) {
    characterButtons.push({
      type: "button",
      action: {
        type: "message",
        label: "清除",
        text: "/清除人物圖片",
      },
    });
  }

  const characterBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "🧑 人物圖片",
          weight: "bold",
          size: "lg",
          margin: "md",
          color: "#333333",
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: characterButtons,
    },
  };

  if (characterUrl) {
    characterBubble.body.contents.push({
      type: "image",
      url: characterUrl,
      size: "full",
      aspectMode: "fit",
      margin: "md",
    } as any);
  } else {
    characterBubble.body.contents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "尚未上傳",
          color: "#999999",
          align: "center",
          size: "md",
        },
      ],
      height: "150px",
      backgroundColor: "#f5f5f5",
      cornerRadius: "8px",
      margin: "md",
      justifyContent: "center",
    } as any);
  }

  bubbles.push(characterBubble);

  // Clothing image bubble
  const clothingButtons: any[] = [
    {
      type: "button",
      action: {
        type: "message",
        label: "上傳",
        text: "/上傳衣物圖片",
      },
      style: "primary",
      color: "#1DB446",
    },
  ];

  // Add clear button if image exists
  if (clothingUrl) {
    clothingButtons.push({
      type: "button",
      action: {
        type: "message",
        label: "清除",
        text: "/清除衣物圖片",
      },
    });
  }

  const clothingBubble = {
    type: "bubble",
    body: {
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "👕 衣物圖片",
          weight: "bold",
          size: "lg",
          margin: "md",
          color: "#333333",
        },
      ],
      paddingAll: "20px",
    },
    footer: {
      type: "box",
      layout: "vertical",
      spacing: "sm",
      contents: clothingButtons,
    },
  };

  if (clothingUrl) {
    clothingBubble.body.contents.push({
      type: "image",
      url: clothingUrl,
      size: "full",
      aspectMode: "fit",
      margin: "md",
    } as any);
  } else {
    clothingBubble.body.contents.push({
      type: "box",
      layout: "vertical",
      contents: [
        {
          type: "text",
          text: "尚未上傳",
          color: "#999999",
          align: "center",
          size: "md",
        },
      ],
      height: "150px",
      backgroundColor: "#f5f5f5",
      cornerRadius: "8px",
      margin: "md",
      justifyContent: "center",
    } as any);
  }

  bubbles.push(clothingBubble);

  return {
    type: "flex",
    altText: "您的圖片",
    contents: {
      type: "carousel",
      contents: bubbles,
    },
  };
};

// Message for still processing synthesis
export const stillProcessingMessage: messagingApi.TextMessage = {
  type: "text",
  text: "🔄 產生中，請稍等...",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "查看結果",
          text: "/查看結果",
        },
      },
    ],
  },
};

// Message for synthesis failure with re-upload options
export const synthesisFailedMessage: messagingApi.TextMessage = {
  type: "text",
  text: "❌ 合成失敗，請重新上傳更容易辨識的圖片",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "重新上傳人物",
          text: "/上傳人物圖片",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "重新上傳衣物",
          text: "/上傳衣物圖片",
        },
      },
    ],
  },
};

// Message when no active synthesis is found
export const noActiveSynthesisMessage: messagingApi.TextMessage = {
  type: "text",
  text: "目前沒有進行中的合成任務",
  quickReply: {
    items: [
      {
        type: "action",
        action: {
          type: "message",
          label: "開始合成",
          text: "/開始合成",
        },
      },
      {
        type: "action",
        action: {
          type: "message",
          label: "更多選項",
          text: "/更多選項",
        },
      },
    ],
  },
};
