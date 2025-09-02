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

The application follows a **provider-service-controller pattern** with **Redis-based state management** and **reply-only messaging** for improved reliability and user experience.

**Provider Layer** (`src/providers/`):
- `RedisProvider` - Redis connection management with singleton pattern
- `LineProvider` - LINE Bot SDK integration and webhook handling
- `GeminiProvider` - Google Gemini AI image generation
- `ExpressProvider` - Express.js server setup and middleware

**Service Layer** (`src/services/`):
- `UserStateService` - Redis-based state management with atomic operations
- `CommandService` - Business logic and command routing
- `LineService` - LINE webhook event processing
- `ImageCacheService` - Redis-backed file system image storage
- `ReplyService` - LINE message composition using atomic components
- `ConfigService` - Environment configuration management

**Atomic UI System** (`src/utils/reply/`):
- `atoms.ts` - Reusable LINE UI components (buttons, actions)
- `basic.ts` - Composite UI arrays built from atoms
- `messages.ts` - Complete message templates with Flex Messages

### Redis-Based State Management

The application uses **Redis for all state persistence** with automatic TTL and atomic operations:

**UserStateService** (`src/services/userStateService.ts`):
- **User States**: `idle`, `waiting_for_character`, `waiting_for_clothing`, `waiting_for_image_type`, `generating_image`
- **Operation Locks**: Prevents concurrent operations with 2-minute timeout
- **Pending Images**: 5-minute TTL for image type confirmation
- **Synthesis Results**: 30-minute TTL for background processing results
- **Atomic State Transitions**: Lua script-based transitions for consistency

**Key Features**:
- Thread-safe operations with Redis locks
- Automatic cleanup with configurable TTL
- State transition validation
- Background operation coordination

### User-Driven Synthesis Flow

**Reply-Only Architecture**: All bot responses use `replyMessage` instead of `pushMessage` for better user experience and LINE API compliance.

**Dual-Mode Image Upload**:
- **Active Mode**: User uploads image → Bot asks for type → Processes accordingly
- **Passive Mode**: User selects type → Bot waits for image → Auto-processes when complete

**Background Synthesis Process**:
1. User initiates synthesis → Immediate reply with processing message
2. Background synthesis runs with Redis result storage
3. User polls for results via "/查看結果" command
4. Success/failure handled with appropriate retry options

### Enhanced Image Management

**ImageCacheService with Redis Integration**:
- **File Storage**: Local filesystem in `images/{userId}/` directory
- **Redis Metadata**: Image paths stored in Redis hashes with TTL
- **Automatic Cleanup**: 30-minute inactivity cleanup for both files and Redis
- **URL Generation**: Public URLs with timestamp cache busting

**Image Types**:
- `character.jpg` - Person/character image
- `clothing.jpg` - Clothing item image  
- `generated_{timestamp}.jpg` - AI-synthesized results

### Command System Architecture

**CommandService** handles all business logic with modular command handlers:

**Core Commands**:
- Upload commands: `/上傳人物圖片`, `/上傳衣物圖片`
- Clear commands: `/清除人物圖片`, `/清除衣物圖片`, `/全部清除`
- Synthesis commands: `/合成圖片`, `/開始合成`, `/查看結果`
- Utility commands: `/瀏覽現有圖片`, `/使用方式`, `/更多選項`

**State-Aware Processing**:
- Automatic synthesis trigger when both images present
- Context-sensitive error handling with retry options
- Quick reply suggestions based on current user state

### Synthesis Result Management

**Background Processing with Redis Storage**:
- **Processing State**: User state transitions to `generating_image`
- **Result Storage**: Success/failure stored in Redis with metadata
- **User Polling**: Users check results via dedicated command
- **Error Recovery**: Failed synthesis provides re-upload options

**Synthesis States**:
- `processing` - Synthesis in progress
- `completed` - Success with image path
- `failed` - Error with message and retry options

### LINE Message System

**Atomic Design Pattern**:
- **Atoms**: Individual UI components (buttons, actions)
- **Molecules**: Composite arrays for specific contexts
- **Templates**: Complete Flex Messages with dynamic content

**Key Message Types**:
- **Quick Reply Messages**: Context-sensitive button options
- **Flex Carousel**: Browse images with generated results prioritized
- **Processing Messages**: User-friendly synthesis status updates
- **Error Messages**: Clear error descriptions with recovery actions

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
- Lock keys for operation coordination: `user:lock:{userId}`
- TTL-based automatic cleanup

### Concurrency and Race Condition Prevention

**Operation Locks**:
- Atomic lock acquisition using Redis SET NX EX
- 2-minute lock timeout prevents stuck operations
- Automatic lock cleanup on operation completion

**State Transitions**:
- Lua script-based atomic state changes
- Expected state validation prevents race conditions
- Failed transitions logged for debugging

### Error Recovery and User Experience

**Synthesis Error Handling**:
- Background synthesis isolates errors from user interaction
- Failed synthesis provides specific re-upload guidance
- Redis result storage enables reliable status checking

**Image Upload Resilience**:
- Duplicate upload protection via state management
- Clear error messages for failed image processing
- Quick retry options for transient failures

### Development and Debugging

**Logging System**:
- Color-coded console logging with service identification
- Error tracking with stack traces
- Operation timing and performance monitoring

**Development Commands**:
- `/init` command for development state reset (dev only)
- Redis statistics available via service methods
- Image cache statistics for debugging

**Production Considerations**:
- Environment-based feature flags
- Graceful service degradation
- Resource monitoring and cleanup
