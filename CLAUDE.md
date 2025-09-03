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
```

### Environment Setup

Copy `.env.example` to `.env` and configure:

- `LINE_CHANNEL_ACCESS_TOKEN` - LINE Bot channel access token
- `LINE_CHANNEL_SECRET` - LINE Bot channel secret
- `GEMINI_API_KEY` - Google Gemini API key for image generation
- `BASE_URL` - Public webhook URL for LINE Bot
- `PORT` - Server port (default: 8000)
- `REDIS_URL` - Redis connection URL (default: redis://127.0.0.1:6379)
- `CLOUDFLARE_TUNNEL_TOKEN` - Optional Cloudflare tunnel token

## Architecture Overview

### Core System Design

The application follows a **refactored flow-based architecture** with **Redis-based state management** and **passive user-guided flows** for improved reliability and user experience.

**Provider Layer** (`src/providers/`):
- `RedisProvider` - Redis connection management with singleton pattern
- `LineProvider` - LINE Bot SDK integration and webhook handling
- `GeminiProvider` - Google Gemini AI image generation
- `ExpressProvider` - Express.js server setup and middleware

**Service Layer** (`src/services/`):
- `FlowManagerService` - Core state machine for managing user flows and business logic
- `CommandParserService` - Text message parsing into standardized command objects
- `UserStateService` - Redis-based state management with atomic operations and locks
- `LineService` - LINE webhook event processing and message routing
- `ImageCacheService` - Redis-backed file system image storage
- `ReplyService` - LINE message composition using passive flow templates
- `AIService` - AI image synthesis coordination
- `ConfigService` - Environment configuration management

**Passive Flow Templates** (`src/utils/reply/`):
- `passiveFlowTemplates.ts` - Complete message templates for passive user-guided flows

### Refactored State Management

The application uses **Redis for all state persistence** with atomic operations and distributed locks:

**UserStateService** (`src/services/userStateService.ts`):
- **User States**: `idle`, `passive_awaiting_character`, `passive_awaiting_clothing`, `generating_image`, `passive_awaiting_result_check_character`, `passive_awaiting_result_check_clothing`, `active_awaiting_image_type`
- **Distributed Locks**: Prevents concurrent operations with 2-minute timeout using Redis SET NX EX
- **Pending Images**: 5-minute TTL for image type confirmation
- **Synthesis Results**: 30-minute TTL for background processing results
- **Atomic State Transitions**: Thread-safe state changes with validation

**Enhanced Lock System**:
- Operation-specific locks: `user:lock:{userId}:{operation}`
- Automatic lock cleanup with TTL
- Lock exclusion patterns for safe data clearing
- Concurrent operation protection

### Passive User-Guided Flow System

**FlowManagerService** (`src/services/flowManagerService.ts`):
- **Event-Driven Architecture**: Processes TEXT_MESSAGE, IMAGE_MESSAGE, and FOLLOW events
- **State-Aware Routing**: Routes events based on current user state
- **Command Processing**: Integrates with CommandParserService for text command parsing

**Command System** (`src/services/commandParserService.ts`):
- **Standardized Commands**: START_FLOW, CHECK_RESULT, REGENERATE, REUPLOAD_CHARACTER, REUPLOAD_CLOTHING, CLEAR_CHARACTER, CLEAR_CLOTHING, CLEAR_ALL, DEV_INIT
- **Text-to-Command Mapping**: Chinese and English command recognition
- **Unknown Command Handling**: Graceful fallback for unrecognized inputs

**Core User Flow**:
1. **Welcome State** (`idle`): User starts with welcome message and "開始使用" button
2. **Character Upload** (`passive_awaiting_character`): Guided character image upload
3. **Clothing Upload** (`passive_awaiting_clothing`): Guided clothing image upload  
4. **Background Synthesis** (`generating_image`): Automatic synthesis initiation
5. **Result Check** (`passive_awaiting_result_check_character/clothing`): Results polling with re-upload options

### Enhanced Image Management

**ImageCacheService with Redis Integration**:
- **File Storage**: Local filesystem in `images/{userId}/` directory
- **Redis Metadata**: Image paths stored in Redis hashes with TTL
- **Automatic Cleanup**: 30-minute inactivity cleanup for both files and Redis
- **URL Generation**: Public URLs with timestamp cache busting
- **Complete Clearing**: `clearAll()` method for development reset

**Image Types**:
- `character.jpg` - Person/character image
- `clothing.jpg` - Clothing item image  
- `generated_{timestamp}.jpg` - AI-synthesized results

### State-Specific Message Handling

**Flow State Routing**:
- **Idle State**: Command processing for START_FLOW, REGENERATE, REUPLOAD operations, DEV_INIT
- **Awaiting Character**: Clear operations and default reminders
- **Awaiting Clothing**: Clear operations and default reminders  
- **Generating Image**: Status checking and user feedback
- **Result Check States**: Result polling, regeneration, re-upload options

**Re-upload Flow Enhancement**:
- **Separate Result States**: `passive_awaiting_result_check_character` and `passive_awaiting_result_check_clothing`
- **Context-Aware Re-upload**: Maintains context of last uploaded image type
- **Precise Messaging**: Dedicated re-upload messages ("請重新上傳您的人物圖片", "請重新上傳您的衣物圖片")

### Synthesis Result Management

**Background Processing with Redis Storage**:
- **Processing State**: User state transitions to `generating_image`
- **Result Storage**: Success/failure stored in Redis with metadata and TTL
- **User Polling**: Users check results via "查看結果" command
- **Error Recovery**: Failed synthesis provides specific re-upload options
- **Image Type Context**: Tracks which image type was uploaded last for proper routing

**Synthesis States**:
- `processing` - Synthesis in progress
- `completed` - Success with image path
- `failed` - Error with message and retry options

### LINE Message System

**Passive Flow Templates**:
- **Welcome Messages**: Guided onboarding with step-by-step instructions
- **Request Messages**: Context-specific upload requests with camera/gallery options
- **Processing Messages**: User-friendly synthesis status updates
- **Result Messages**: Success/failure feedback with action buttons
- **Re-upload Messages**: Specific messages for re-upload scenarios
- **Error Messages**: Clear error descriptions with recovery actions

**Quick Reply Integration**:
- Camera and gallery access for image uploads
- Context-sensitive action buttons
- State-appropriate command suggestions

### Development Infrastructure

**TypeScript Configuration**:
- Strict TypeScript with ES2020 target
- CommonJS modules with source maps for debugging
- ESLint with TypeScript rules and Prettier integration

**Error Handling**:
- Centralized `ConsoleHandler` with color-coded logging
- Graceful degradation for service failures
- Redis connection resilience with retry logic

**Server Architecture**:
- Express.js with graceful shutdown handling
- Static file serving for image URLs
- Connection tracking for clean shutdowns
- Health monitoring with Redis ping tests

## Key Implementation Details

### Redis Integration Patterns

**Connection Management**:
- Singleton `RedisProvider` with connection pooling
- Automatic reconnection with exponential backoff
- Connection health monitoring and logging

**Data Patterns**:
- Hash storage for user image metadata: `user:{userId}:images`
- String storage for user states: `user:state:{userId}`
- Lock keys for operation coordination: `user:lock:{userId}:{operation}`
- Pending images: `user:pending:{userId}`
- Synthesis results: `user:synthesis:{userId}`
- TTL-based automatic cleanup

### Concurrency and Race Condition Prevention

**Distributed Lock System**:
- Atomic lock acquisition using Redis SET NX EX
- Operation-specific locks (character_upload, clothing_upload, synthesis, dev_init)
- 2-minute lock timeout prevents stuck operations
- Automatic lock cleanup on operation completion
- Lock exclusion patterns for safe data clearing

**State Transitions**:
- Thread-safe state transitions with expected state validation
- Failed transitions logged for debugging
- Atomic operations prevent race conditions

### Error Recovery and User Experience

**Synthesis Error Handling**:
- Background synthesis isolates errors from user interaction
- Failed synthesis provides specific re-upload guidance
- Redis result storage enables reliable status checking
- Context-aware error recovery based on last uploaded image type

**Image Upload Resilience**:
- Duplicate upload protection via state management
- Clear error messages for failed image processing
- Quick retry options for transient failures
- State-aware upload flow routing

### Development and Debugging

**Logging System**:
- Color-coded console logging with service identification
- Error tracking with stack traces
- Operation timing and performance monitoring

**Development Commands**:
- `/init` command for complete development state reset (dev only)
- Safe data clearing with lock exclusion
- Redis statistics available via service methods
- Image cache statistics for debugging

**Production Considerations**:
- Environment-based feature flags
- Graceful service degradation
- Resource monitoring and cleanup
- Distributed lock management

## Recent Architecture Changes

### Major Refactoring (Current Implementation)

**Removed Components**:
- `CommandService` - Replaced by `FlowManagerService` + `CommandParserService`
- Atomic UI system (`atoms.ts`, `basic.ts`, `messages.ts`) - Replaced by `passiveFlowTemplates.ts`

**New Components**:
- `FlowManagerService` - Central state machine and business logic coordinator
- `CommandParserService` - Standardized command parsing and mapping
- `passiveFlowTemplates.ts` - Complete passive flow message templates

**Enhanced Features**:
- **Split Result Check States**: Separate states for character and clothing result checking
- **Improved Re-upload Flow**: Context-aware re-upload with precise messaging
- **Enhanced Lock Management**: Operation-specific locks with exclusion patterns
- **Better Error Handling**: State-aware error recovery and user guidance
- **Development Tools**: Enhanced `/init` command with safe concurrent operations

### Flow State Machine Updates

**New State Definitions**:
- `PASSIVE_AWAITING_RESULT_CHECK_CHARACTER` - After character-driven synthesis
- `PASSIVE_AWAITING_RESULT_CHECK_CLOTHING` - After clothing-driven synthesis
- Removed: `PASSIVE_AWAITING_RESULT_CHECK` (replaced by context-specific states)

**Event Handling**:
- State-specific event routing in `FlowManagerService`
- Command parsing integration with passive flow templates
- Context preservation across state transitions

This refactored architecture provides better user experience, improved reliability, and cleaner separation of concerns while maintaining all existing functionality with enhanced error handling and development tools.