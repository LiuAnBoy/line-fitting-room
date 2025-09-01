import { messagingApi } from "@line/bot-sdk";

/**
 * @file Defines atomic, reusable Quick Reply action objects.
 * These are the basic building blocks for creating quick reply button menus.
 */

// ===== Basic Action Atoms =====

// --- Upload-related Actions ---
export const uploadCharacterAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "上傳人物圖片",
    text: "/上傳人物圖片",
  },
};

export const uploadClothingAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "上傳衣物圖片",
    text: "/上傳衣物圖片",
  },
};

// --- Clear-related Actions ---
export const clearCharacterAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "清除人物圖片",
    text: "/清除人物圖片",
  },
};

export const clearClothingAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "清除衣物圖片",
    text: "/清除衣物圖片",
  },
};

export const clearAllAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "全部清除",
    text: "/全部清除",
  },
};

// --- Function-related Actions ---
export const synthesizeAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "開始合成",
    text: "/開始合成",
  },
};

export const helpAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "使用方式",
    text: "/使用方式",
  },
};

export const browseImagesAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "瀏覽現有圖片",
    text: "/瀏覽現有圖片",
  },
};

export const moreOptionsAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "更多選項",
    text: "/更多選項",
  },
};

// --- Camera-related Actions ---
export const cameraAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "camera",
    label: "拍照",
  },
};

export const cameraRollAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "cameraRoll",
    label: "相簿",
  },
};

// Array of camera actions.
export const cameraActions: messagingApi.QuickReplyItem[] = [
  cameraAction,
  cameraRollAction,
];

// --- Image Type Selection Actions ---
export const characterTypeAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "人物圖片",
    text: "人物圖片",
  },
};

export const clothingTypeAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "衣物圖片",
    text: "衣物圖片",
  },
};

// Array of image type selection actions.
export const imageTypeActions: messagingApi.QuickReplyItem[] = [
  characterTypeAction,
  clothingTypeAction,
];

// --- Update Confirmation Actions ---
export const updateClothingAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "是，更新衣物圖片",
    text: "更新衣物圖片",
  },
};

export const updateCharacterAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "是，更新人物圖片",
    text: "更新人物圖片",
  },
};

export const directSynthesizeAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "否，直接合成",
    text: "直接合成",
  },
};

// Arrays for update confirmation flows.
export const updateClothingActions: messagingApi.QuickReplyItem[] = [
  updateClothingAction,
  directSynthesizeAction,
];

export const updateCharacterActions: messagingApi.QuickReplyItem[] = [
  updateCharacterAction,
  directSynthesizeAction,
];

// --- Restart-related Actions ---
export const startAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "開始使用",
    text: "/上傳人物圖片",
  },
};

export const restartAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "重新開始",
    text: "/上傳人物圖片",
  },
};

// --- Regenerate and Download Actions ---
export const regenerateAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "重新生成",
    text: "/合成圖片",
  },
};

export const downloadAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "下載圖片",
    text: "/下載圖片",
  },
};

// Array of actions for a generated image.
export const generatedImageActions: messagingApi.QuickReplyItem[] = [
  regenerateAction,
  downloadAction,
];

// ===== Special Label Versions for Menus =====

export const uploadCharacterPhotoAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "上傳人物照片",
    text: "/上傳人物圖片",
  },
};

export const uploadClothingPhotoAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "上傳衣物照片",
    text: "/上傳衣物圖片",
  },
};

export const clearCharacterPhotoAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "清除人物照片",
    text: "/清除人物圖片",
  },
};

export const clearClothingPhotoAction: messagingApi.QuickReplyItem = {
  type: "action",
  action: {
    type: "message",
    label: "清除衣物照片",
    text: "/清除衣物圖片",
  },
};

// Array of actions for the post-synthesis menu.
export const afterSynthesisActions: messagingApi.QuickReplyItem[] = [
  browseImagesAction,
  uploadCharacterPhotoAction,
  uploadClothingPhotoAction,
  clearCharacterPhotoAction,
  clearClothingPhotoAction,
  clearAllAction,
];
