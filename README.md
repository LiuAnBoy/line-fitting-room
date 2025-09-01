# LINE Fitting Room Bot

## Project Introduction

This is an application developed using LINE Bot SDK, Google Gemini API, and Express.js. It allows users to upload character images and clothing images, then utilizes AI technology to synthesize the clothing onto the character, creating a virtual try-on effect.

## Features

- **AI Virtual Try-On**: Combines character and clothing images to generate new synthesized images.
- **Image Management**: Supports uploading, clearing character, and clothing images.
- **Conversational Interaction**: Operates through LINE message commands.
- **Dockerized Deployment**: Facilitates quick deployment and environment isolation.
- **Cloudflare Tunnel Integration**: Provides secure external connectivity without exposing ports.

## Prerequisites

Before you begin, ensure your system has the following software installed:

- **Git**: For cloning the project repository.
- **Node.js**: Version 18 or higher.
- **pnpm**: As the package manager (recommended).
- **Docker & Docker Compose**: For containerized deployment.

## Project Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-repo/line-fitting-room.git
cd line-fitting-room
```

### 2. Install Dependencies

Install all project dependencies using pnpm:

```bash
pnpm install
```

### 3. Environment Variables Configuration (.env Configuration)

Copy the `.env.example` file and rename it to `.env`. Then fill in your API keys and relevant settings.

```bash
cp .env.example .env
```

Open the `.env` file and fill in the following variables:

- **`PORT`**: The port your application listens on inside the container (default 8000).
- **`NODE_ENV`**: The operating environment (`development` or `production`).
- **`BASE_URL`**: The public-facing URL of your application.
  - **Local Development**: `http://localhost`
  - **Production**: `https://your_domain` (e.g., `https://line.example.com`)
- **`LINE_CHANNEL_ACCESS_TOKEN`**: Your LINE Bot Channel Access Token.
- **`LINE_CHANNEL_SECRET`**: Your LINE Bot Channel Secret.
- **`GEMINI_API_KEY`**: Your Google Gemini API Key.
- **`REDIS_URL`**: Redis connection URL (default `redis://redis:6379`, for local development use `redis://localhost:6379`).
- **`CLOUDFLARE_TUNNEL_TOKEN`**: (Optional) If you are using Cloudflare Tunnel, fill in your Tunnel Token.

  ```
  # .env example
  PORT=8000
  NODE_ENV=development
  BASE_URL=http://localhost # or https://line.example.com
  LINE_CHANNEL_ACCESS_TOKEN=your_line_channel_access_token
  LINE_CHANNEL_SECRET=your_line_channel_secret
  GEMINI_API_KEY=your_gemini_api_key
  REDIS_URL=redis://localhost:6379 # for local development
  CLOUDFLARE_TUNNEL_TOKEN=eyJhIjoi... # Your Cloudflare Tunnel Token
  ```

## Running the Application

You can choose one of the following two ways to run the application:

### Option 1: Using Docker Compose (Recommended for Deployment)

This method starts all services (Cloudflare Tunnel, Nginx, Node.js App, Redis).

```bash
docker-compose up -d --build
```

- **Cloudflare Tunnel Integration**:
  - If `CLOUDFLARE_TUNNEL_TOKEN` is set in your `.env`, the `cloudflared` service will start and establish a secure tunnel.
  - **If you are not using Cloudflare Tunnel**: You can ignore the `cloudflared` service in `docker-compose.yml`, or comment it out. Even if the `cloudflared` service fails to start due to a missing Token, other services (Nginx, App, Redis) will still run normally. In this case, Nginx will listen on ports 80 and 443 of your host machine.

### Option 2: Local Development (Node.js App on Host, Redis in Docker)

This method is suitable for local Node.js code development while leveraging Docker to quickly start dependent services like Redis.

1.  **Start Redis Service**:

    ```bash
    docker-compose -f docker-compose.dev.yml up -d
    ```

    This will start the Redis service on `localhost:6379` of your host machine.

2.  **Start Node.js Application Locally**:
    - Ensure that `REDIS_URL` in your `.env` file is set to `redis://localhost:6379`.
    - Run the development server:
      ```bash
      pnpm run dev
      ```

## Cloudflare Tunnel Setup (Optional but Recommended for Production)

Cloudflare Tunnel provides a secure way to expose your local services to the internet without opening any ports.

1.  **Obtain Tunnel Token**:
    - Log in to the Cloudflare Zero Trust dashboard (`dash.cloudflare.com`).
    - Navigate to **Access** -> **Tunnels**.
    - Create a new Tunnel and note down the Token it provides. Fill this Token into the `CLOUDFLARE_TUNNEL_TOKEN` variable in your `.env` file.

2.  **Configure Public Hostname**:
    - In the Cloudflare Zero Trust dashboard, go to your created Tunnel's configuration page.
    - In the **Public Hostnames** section, click **Add a public hostname**.
    - **Domain**: Select your primary domain (e.g., `example.com`).
    - **Subdomain**: Enter your desired subdomain (e.g., `line`), which will form `line.example.com`.
    - **Service**:
      - **Type**: Select `HTTP`.
      - **URL**: Enter `http://nginx:80`. This is the target where Cloudflare Tunnel will forward traffic, i.e., your Nginx service within the Docker Compose network.

## LINE Bot Webhook Setup

Finally, you need to configure your Bot's Webhook URL in the LINE Developers Console.

- Log in to the LINE Developers Console.
- Select your Provider and Channel.
- In the **Messaging API** settings page, find **Webhook URL**.
- Set it to your public domain followed by the `/webhook` path, for example:
  ```
  https://line.example.com/webhook
  ```
- Ensure **Use webhook** is enabled.

---

## Contributing

Contributions of any kind are welcome!

## License

MIT
