# AI 提示詞管理

本資料夾包含所有 AI 服務使用的提示詞檔案，位於專案根目錄。

## 檔案結構

```
line-fitting-room/
├── src/
├── prompts/                 # AI 提示詞檔案目錄
│   ├── README.md            # 本說明文件
│   └── image-synthesis.md   # 圖片合成提示詞
└── package.json
```

## 使用規則

1. **檔案命名**: 使用 kebab-case 命名，如 `image-synthesis.md`
2. **檔案格式**: 純 Markdown 文字，不包含 frontmatter
3. **編碼格式**: UTF-8 編碼
4. **載入方式**: 伺服器啟動時通過 PromptService 載入

## 修改提示詞

1. 修改對應的 `.md` 檔案
2. 重新啟動伺服器載入新的提示詞
3. 測試 AI 功能確保正常運作

## 新增提示詞

1. 在本資料夾建立新的 `.md` 檔案
2. 在 PromptService 中註冊新的提示詞鍵值
3. 在相應的服務中使用 `getPrompt()` 方法取得提示詞