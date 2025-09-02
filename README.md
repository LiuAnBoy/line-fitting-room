# LINE AI Fitting Room

An AI-powered virtual fitting room LINE Bot. This application allows users to upload images of a person and an item of clothing, then utilizes the Google Gemini API to generate a new image of the person wearing the selected garment.

---

## ✨ Features

- **AI-Powered Virtual Try-On**: Leverages Google Gemini to synthesize clothing onto a person's image.
- **Interactive Bot Commands**: A rich set of commands for a complete user experience.
- **Stateful Conversations**: Remembers user state (e.g., waiting for a specific image) for a natural workflow.
- **Image Caching**: Uses Redis to cache uploaded images, improving performance.
- **Robust Configuration**: Employs Zod for strict, fail-fast environment variable validation on startup.
- **Containerized**: Fully containerized with Docker and Docker Compose for easy setup and deployment.

---

## 🏛️ Architecture Overview

The application consists of a main Node.js/Express server that handles the LINE webhook, and communicates with external services for its core functionality.

```
+-----------------+      +-----------------+      +----------------------+
|   User on LINE  | <--> |   LINE Platform | <--> |  Express Server (App)| 
+-----------------+      +-----------------+      +----------------------+
                                                     |           ^
                                                     |           |
                                                     v           |
                                             +-----------+   +-------------+
                                             |   Redis   |   | Google      |
                                             | (Cache)   |   | Gemini API  |
                                             +-----------+   +-------------+
```

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or higher)
- [pnpm](https://pnpm.io/) (v10 or higher)
- [Docker](https://www.docker.com/) and [Docker Compose](https://docs.docker.com/compose/)

### 1. Clone & Install

Clone the repository and install the dependencies:

```bash
git clone https://github.com/your-repo/line-fitting-room.git
cd line-fitting-room
pnpm install
```

### 2. Configure Environment

Copy the example `.env` file and fill in your credentials.

```bash
cp .env.example .env
```

**`/.env`**

| Variable                  | Description                                                                 |
| ------------------------- | --------------------------------------------------------------------------- |
| `PORT`                    | The port for the Express server (default: `8000`).                          |
| `NODE_ENV`                | Environment (`development` or `production`).                                |
| `BASE_URL`                | Public URL for serving images (e.g., `https://your-domain.com`).            |
| `LINE_CHANNEL_ACCESS_TOKEN` | Your LINE Bot's Channel Access Token.                                       |
| `LINE_CHANNEL_SECRET`     | Your LINE Bot's Channel Secret.                                             |
| `GEMINI_API_KEY`          | Your Google Gemini API Key.                                                 |
| `REDIS_URL`               | Connection URL for Redis (e.g., `redis://redis:6379`).                      |
| `CLOUDFLARE_TUNNEL_TOKEN` | (Optional) Your token for Cloudflare Tunnel.                                |


### 3. Run the Application

You can run the application using Docker Compose (recommended) or locally for development.

**Using Docker Compose (Production & Development):**

This is the simplest way to start all required services.

```bash
docker-compose up -d --build
```

**Local Development:**

This is useful for actively developing the Node.js application while running Redis in Docker.

1.  **Start Redis in Docker:**
    ```bash
    docker-compose -f docker-compose.dev.yml up -d
    ```

2.  **Run the Node.js Server:**
    (Ensure `REDIS_URL` in `.env` is set to `redis://localhost:6379`)
    ```bash
    pnpm run dev
    ```

### 4. Setup Webhook

Finally, configure your LINE Bot's webhook URL in the [LINE Developers Console](https://developers.line.biz/console/) to point to your public `BASE_URL`.

- **Webhook URL**: `https://<your_base_url>/webhook`
- Make sure to enable "Use webhook".

---

## 🤖 Bot Commands

Interact with the bot using the following commands:

| Command         | Description                                          |
| --------------- | ---------------------------------------------------- |
| `/使用方式`       | Shows the help message.                              |
| `/上傳人物圖片`   | Initiates the process to upload a person's image.    |
| `/上傳衣物圖片`   | Initiates the process to upload a clothing image.    |
| `/合成圖片`       | Starts the image synthesis process.                  |
| `/瀏覽現有圖片`   | Shows a carousel of your currently uploaded images.  |
| `/下載圖片`       | Displays the last generated image for download.      |
| `/清除人物圖片`   | Deletes your uploaded person image.                  |
| `/清除衣物圖片`   | Deletes your uploaded clothing image.                |
| `/全部清除`       | Deletes all your data, including all images.         |
| `/更多選項`       | Shows a menu with more actions.                      |

---

## 🛠️ Development

This project uses `pnpm` as the package manager.

| Script      | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `pnpm dev`  | Starts the server in development mode with `nodemon` for auto-reloading. |
| `pnpm build`| Compiles the TypeScript source code to JavaScript in the `/dist` folder. |
| `pnpm start`| Starts the server in production mode from the compiled code.             |

Linting and formatting are configured with ESLint and Prettier.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

## 📄 License

This project is [MIT](./LICENSE) licensed.