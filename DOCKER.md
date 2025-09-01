# Docker 部署指南

## 快速開始

### 1. 環境設置

```bash
# 複製環境變量範例文件
cp .env.example .env

# 編輯 .env 文件，填入你的 API 密鑰
nano .env
```

### 2. 部署應用

```bash
# 構建並啟動服務
docker-compose up -d

# 查看日誌
docker-compose logs -f

# 停止服務
docker-compose down
```

## 服務說明

- **line-fitting-room**: LINE Bot 應用
  - 端口: 3000
  - 健康檢查: http://localhost:3000/health

### 數據持久化

以下目錄會被持久化保存：
- `./logs`: 應用日誌
- `./uploads`: 用戶上傳的圖片
- `./temp`: 臨時文件

## 常用命令

```bash
# 查看運行狀態
docker-compose ps

# 查看日誌
docker-compose logs -f

# 重新構建
docker-compose build --no-cache

# 清理
docker-compose down && docker system prune -a
```

## 環境變量

| 變量名 | 描述 | 必填 |
|--------|------|------|
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE Bot 訪問令牌 | ✅ |
| `LINE_CHANNEL_SECRET` | LINE Bot 頻道秘鑰 | ✅ |
| `GEMINI_API_KEY` | Google Gemini API 密鑰 | ✅ |
| `BASE_URL` | 應用基礎 URL | ❌ |