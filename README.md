# LINE AI 虛擬試衣間

一個由 AI 驅動的 LINE 虛擬試衣間機器人。此應用程式允許使用者上傳人物和衣物的圖片，並利用 Google Gemini API 來生成使用者穿上該服裝的新圖片。

---

## ✨ 功能亮點

- **AI 虛擬試衣**：利用 Google Gemini 將服裝合成到人物圖片上。
- **狀態機架構**：採用了以 `FlowManagerService` 為核心的狀態機模式，取代了複雜的指令判斷，使流程清晰且易於擴展。
- **引導式流程**：為新使用者提供引導式的被動流程，一步步完成操作。
- **圖片快取**：使用 Redis 快取使用者上傳的圖片，提升效能並管理圖片的生命週期（30分鐘後自動清除）。
- **穩健的設定**：啟動時使用 Zod 進行嚴格的環境變數驗證，提早發現設定錯誤。
- **容器化**：使用 Docker 和 Docker Compose 完整容器化，簡化了開發和部署的流程。

---

## 🏛️ 系統架構

本應用程式的核心是一個 Node.js/Express 伺服器，它負責處理來自 LINE 的 Webhook 事件，並透過一個清晰的服務導向架構（Service-Oriented Architecture）來處理所有業務邏輯。

### 服務導向架構

- **`LineService`**: 作為 Webhook 的純粹路由器，驗證簽名後，將事件轉發給流程管理器。
- **`FlowManagerService`**: **核心狀態機**。根據使用者的當前狀態和收到的事件，決定要執行哪個動作以及下一個狀態。
- **`CommandParserService`**: 將使用者輸入的文字（如「開始使用」）解析為標準化的指令物件。
- **`UserStateService`**: 專職管理 Redis 中的使用者狀態（例如，`PASSIVE_AWAITING_CHARACTER`）。
- **`ImageCacheService`**: 負責所有圖片的下載、存儲和快取管理。
- **`ReplyService`**: 根據意圖，從模板中生成對應的 LINE 訊息物件。
- **`AIService`**: 專門處理與 Google Gemini API 的所有互動。

```
+-----------------+      +-----------------+      +-------------------------+
|   User on LINE  | <--> |   LINE Platform | <--> |  Express Server (App)   |
+-----------------+      +-----------------+      +-------------------------+
                                                     |           ^
                                                     |           |
                                                     v           |
                                             +-----------+   +-------------+
                                             |   Redis   |   | Google      |
                                             | (Cache)   |   | Gemini API  |
                                             +-----------+   +-------------+
```

---

## 🚀快速開始

### 環境需求

- [Node.js](https://nodejs.org/) (v18 或更高版本)
- [pnpm](https://pnpm.io/) (v10 或更高版本)
- [Docker](https://www.docker.com/) 和 [Docker Compose](https://docs.docker.com/compose/)

### 1. 複製專案並安裝依賴

```bash
git clone https://github.com/your-repo/line-fitting-room.git
cd line-fitting-room
pnpm install
```

### 2. 設定環境變數

複製 `.env.example` 檔案為 `.env`，並填入您的金鑰。

```bash
cp .env.example .env
```

**`/.env`**

| 變數                        | 描述                                                      |
| --------------------------- | --------------------------------------------------------- |
| `PORT`                      | Express 伺服器的埠號 (預設: `8000`)。                     |
| `NODE_ENV`                  | 環境 (`development` 或 `production`)。                    |
| `BASE_URL`                  | 用於提供圖片的公開網址 (例如 `https://your-domain.com`)。 |
| `LINE_CHANNEL_ACCESS_TOKEN` | 您的 LINE Bot 的 Channel Access Token。                   |
| `LINE_CHANNEL_SECRET`       | 您的 LINE Bot 的 Channel Secret。                         |
| `GEMINI_API_KEY`            | 您的 Google Gemini API 金鑰。                             |
| `REDIS_URL`                 | Redis 的連線網址 (例如 `redis://127.0.0.1:6379`)。        |
| `CLOUDFLARE_TUNNEL_TOKEN`   | (選用) 您的 Cloudflare Tunnel 權杖。                      |

### 3. 啟動應用程式

您可以使用 Docker Compose（推薦）或在本地端啟動。

**使用 Docker Compose (生產和開發環境):**

這是啟動所有服務最簡單的方式。

```bash
docker-compose up -d --build
```

**本地端開發:**

如果您想在本地端修改 Node.js 程式碼，同時在 Docker 中運行 Redis。

1.  **在 Docker 中啟動 Redis:**

    ```bash
    docker-compose -f docker-compose.dev.yml up -d
    ```

2.  **啟動 Node.js 伺服器:**
    (請確保 `.env` 中的 `REDIS_URL` 指向 `redis://127.0.0.1:6379`)
    ```bash
    pnpm run server
    ```

### 4. 設定 Webhook

最後，在 [LINE Developers Console](https://developers.line.biz/console/) 中設定您的 LINE Bot 的 Webhook URL，使其指向您的公開網址。

- **Webhook URL**: `https://<your_base_url>/webhook`
- 請確保已啟用 "Use webhook"。

---

## 🤖 機器人指令

透過以下指令與機器人互動：

| 指令               | 描述                                     |
| ------------------ | ---------------------------------------- |
| `開始使用`         | 啟動引導式流程，開始上傳圖片。           |
| `查看結果`         | 在合成過程中，用來查詢合成是否已完成。   |
| `重新生成`         | 使用已上傳的兩張圖片，重新進行一次合成。 |
| `重新上傳人物圖片` | 重新上傳人物圖片，並與現有衣物圖片合成。 |
| `重新上傳衣物圖片` | 重新上傳衣物圖片，並與現有人物圖片合成。 |
| `清除人物圖片`     | 僅刪除已上傳的人物圖片。                 |
| `清除衣物圖片`     | 僅刪除已上傳的衣物圖片。                 |
| `清除全部`         | 刪除您所有的資料，並重新開始流程。       |

---

## 🛠️ 開發

本專案使用 `pnpm` 作為套件管理器。

| 指令          | 描述                                                |
| ------------- | --------------------------------------------------- |
| `pnpm server` | 在開發模式下啟動伺服器，使用 `nodemon` 自動重載。   |
| `pnpm build`  | 將 TypeScript 編譯為 JavaScript 到 `/dist` 資料夾。 |
| `pnpm start`  | 在生產模式下，從編譯後的程式碼啟動伺服器。          |

Linting 和格式化已透過 ESLint 和 Prettier 進行設定。
