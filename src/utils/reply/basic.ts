import { messagingApi } from "@line/bot-sdk";

import {
  afterSynthesisActions,
  browseImagesAction,
  cameraActions,
  clearAllAction,
  clearCharacterAction,
  clearClothingAction,
  helpAction,
  imageTypeActions,
  moreOptionsAction,
  regenerateAction,
  restartAction,
  startAction,
  synthesizeAction,
  updateCharacterActions,
  updateClothingActions,
  uploadCharacterAction,
  uploadClothingAction,
} from "./atoms";

/**
 * @file Assembled Quick Reply components.
 * This file combines the atomic components from atoms.ts to form common button layouts.
 */

// ===== Basic Button Groups =====

export const uploadCharacterReply: messagingApi.QuickReplyItem[] = [
  uploadCharacterAction,
];

export const uploadClothingReply: messagingApi.QuickReplyItem[] = [
  uploadClothingAction,
];

export const clearCharacterReply: messagingApi.QuickReplyItem[] = [
  clearCharacterAction,
];

export const clearClothingReply: messagingApi.QuickReplyItem[] = [
  clearClothingAction,
];

export const clearAllReply: messagingApi.QuickReplyItem[] = [clearAllAction];

export const helpReply: messagingApi.QuickReplyItem[] = [helpAction];

export const browseImagesReply: messagingApi.QuickReplyItem[] = [
  browseImagesAction,
];

export const synthesizeReply: messagingApi.QuickReplyItem[] = [
  synthesizeAction,
];

export const cameraReply: messagingApi.QuickReplyItem[] = cameraActions;

export const reGenerateReply: messagingApi.QuickReplyItem[] = [
  regenerateAction,
];

// ===== Composite Button Groups =====

// --- Image type selection ---
export const imageTypeReply: messagingApi.QuickReplyItem[] = imageTypeActions;

// --- Update confirmation options ---
export const updateClothingReply: messagingApi.QuickReplyItem[] =
  updateClothingActions;

export const updateCharacterReply: messagingApi.QuickReplyItem[] =
  updateCharacterActions;

// --- Restart options ---
export const startAgainReply: messagingApi.QuickReplyItem[] = [startAction];

export const restartReply: messagingApi.QuickReplyItem[] = [restartAction];

export const tryAgainReply: messagingApi.QuickReplyItem[] = [moreOptionsAction];

// --- Complex Groups ---

export const retryReply: messagingApi.QuickReplyItem[] = [
  ...reGenerateReply,
  ...uploadCharacterReply,
  ...uploadClothingReply,
];

// Menu shown after synthesis is complete.
export const afterSynthesisReply: messagingApi.QuickReplyItem[] =
  afterSynthesisActions;

/**
 * Generates a dynamic array of quick reply buttons based on the user's image cache status.
 * @param {boolean} hasCharacter - Whether the user has a character image.
 * @param {boolean} hasClothing - Whether the user has a clothing image.
 * @returns {messagingApi.QuickReplyItem[]} An array of quick reply items.
 */
export const getImageStatusReply = (
  hasCharacter: boolean,
  hasClothing: boolean,
): messagingApi.QuickReplyItem[] => {
  const items: messagingApi.QuickReplyItem[] = [];

  // If both images exist, show the synthesize button first.
  if (hasCharacter && hasClothing) {
    items.push(...synthesizeReply);
  }

  // If character image is missing, show the upload button.
  if (!hasCharacter) {
    items.push(...uploadCharacterReply);
  }

  // If clothing image is missing, show the upload button.
  if (!hasClothing) {
    items.push(...uploadClothingReply);
  }

  // If any image exists, show the browse button.
  if (hasCharacter || hasClothing) {
    items.push(...browseImagesReply);
  }

  // If character image exists, show the clear button.
  if (hasCharacter) {
    items.push(...clearCharacterReply);
  }

  // If clothing image exists, show the clear button.
  if (hasClothing) {
    items.push(...clearClothingReply);
  }

  // If both images exist, show the clear all button.
  if (hasCharacter && hasClothing) {
    items.push(...clearAllReply);
  }

  return items;
};

/**
 * Generates quick reply options to show after the user has uploaded their first image.
 * @param {'character' | 'clothing'} uploadedType - The type of image that was just uploaded.
 * @returns {messagingApi.QuickReplyItem[]} An array of quick reply items.
 */
export const afterFirstUploadReply = (
  uploadedType: "character" | "clothing",
): messagingApi.QuickReplyItem[] => {
  const items: messagingApi.QuickReplyItem[] = [];

  // Allow uploading the other image type.
  if (uploadedType === "character") {
    items.push(...uploadClothingReply);
  } else {
    items.push(...uploadCharacterReply);
  }

  // Allow clearing the image that was just uploaded.
  if (uploadedType === "character") {
    items.push(...clearCharacterReply);
  } else {
    items.push(...clearClothingReply);
  }

  return items;
};

// A comprehensive set of all commands for a general-purpose menu.
export const allCommandReply: messagingApi.QuickReplyItem[] = [
  ...uploadCharacterReply,
  ...uploadClothingReply,
  ...clearCharacterReply,
  ...clearClothingReply,
  ...clearAllReply,
  ...helpReply,
];
