# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a LINE Bot application that provides a virtual fitting room service using AI image synthesis. Users can upload character and clothing images, and the bot generates synthetic images showing the character wearing the selected clothing using Google's Gemini AI.

## Development Commands

### Essential Commands

```bash
# Development with auto-rebuild and restart
pnpm run server

# Production build
pnpm run build

# Production start
pnpm start

# Linting
pnpm run lint
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Bot channel access token
- `LINE_CHANNEL_SECRET` - LINE Bot channel secret
- `GEMINI_API_KEY` - Google Gemini API key for image generation
- `BASE_URL` - Public webhook URL for LINE Bot
- `PORT` - Server port (default: 8080)

## Architecture Overview

### Core System Design

The application follows a provider-service-controller pattern with singleton services for state management:

**Provider Layer** (`src/providers/`):

- `LineProvider` - LINE Bot SDK integration and webhook handling
- `GeminiProvider` - Google Gemini AI image generation
- `ExpressProvider` - Express.js server setup and middleware

**Service Layer** (`src/services/`):

- `LineService` - Core bot logic with dual-mode image upload flow
- `ImageCacheService` - File system-based image storage with 30-min auto-cleanup
- `ReplyService` - LINE message composition using atomic components
- `ConfigService` - Environment configuration management

**Atomic UI System** (`src/utils/reply/`):

- `atoms.ts` - Reusable LINE UI components (buttons, actions)
- `basic.ts` - Composite UI arrays built from atoms
- `messages.ts` - Complete message templates with Flex Messages

### Image Upload Flow Architecture

The bot supports two distinct user flows:

**Active Mode**: User uploads image first → Bot asks for image type → Processes accordingly
**Passive Mode**: User selects image type first → Bot waits for corresponding image upload

State management uses `Map<userId, UserState>` with states:

- `waiting_for_character` / `waiting_for_clothing` - Passive mode states
- `waiting_for_image_type` - Active mode state after image upload
- `idle` - Default state

### Image Storage and Lifecycle

Images are stored in `images/{userId}/` with filenames:

- `character.jpg` - Character/person image
- `clothing.jpg` - Clothing item image
- `generated_{timestamp}.jpg` - AI-synthesized result images

The `ImageCacheService` provides:

- Automatic cleanup after 30 minutes of inactivity
- URL generation for serving images via Express static middleware
- Path mapping for efficient file system operations
- Support for loading existing images on startup

### Synthesis Logic

When both images are available, the system:

1. Sends processing notification to user
2. Calls Gemini AI with both images and synthesis prompt
3. Saves generated image with timestamp
4. Sends completion message with result image and action buttons
5. Updates image cache with generated image path for future browsing

### LINE Message System

Uses atomic design pattern:

- **Atoms**: Individual UI components (buttons, actions)
- **Molecules**: Composite arrays of atoms for specific contexts
- **Templates**: Complete Flex Messages combining multiple molecules

The browse images feature displays all user images in a carousel, with generated images prioritized first, followed by character and clothing images.

## Key Implementation Details

### Error Handling

Centralized error handling through `ConsoleHandler` with color-coded logging and graceful degradation for failed operations.

### State Persistence

User states and pending images are maintained in memory Maps. Image files persist on disk with automatic cleanup via setTimeout-based garbage collection.

### Webhook Validation

LINE webhook signature validation is handled in the LINE provider layer using the configured channel secret.

### TypeScript Configuration

Strict TypeScript with ES2020 target, CommonJS modules, and source maps for debugging. ESLint with TypeScript rules and Prettier integration for code consistency.
