# 404快樂窩 班級網頁

民生國小 404 的班級網頁：最新消息、聯絡簿（含月曆）、榮譽榜、功課表。
老師在網頁上輸入密碼即可直接編輯內容，家長與學生打開網址就能看到最新資料。

## 架構

```
瀏覽者 ──看──> GitHub Pages（index.html，純靜態網頁）
                    │ 讀取資料 (GET)
                    ▼
          Google Apps Script（免費）
                    │ 驗證老師密碼後寫入 (POST)
                    ▼
          Google 雲端硬碟 class404-data.json（班級資料）
```

## 一次性設定步驟

### 第一步：部署 Google Apps Script（約 5 分鐘）

1. 用您的 Google 帳號打開 <https://script.google.com> → 「新專案」
2. 刪除編輯器裡的預設內容，把本資料夾 `apps-script.gs` 的內容全部貼上，存檔
3. 上方函式下拉選單選 **初次設定** → 按「執行」→ 依提示授權（會要求存取雲端硬碟）
4. 右上角「部署」→「新增部署作業」→ 類型選 **網頁應用程式**：
   - 執行身分：**我**
   - 誰可以存取：**任何人**
5. 按「部署」，複製產生的**網頁應用程式網址**（`https://script.google.com/macros/s/…/exec`）

### 第二步：把網址填進網頁

打開 `index.html`，找到這一行（在檔案後半段）：

```js
var API_URL = '';
```

把複製的網址貼進引號中，例如：

```js
var API_URL = 'https://script.google.com/macros/s/AKfycb…/exec';
```

### 第三步：上架 GitHub Pages

1. 在 GitHub（帳號 msps00235）建立一個**公開**儲存庫，例如 `class`
2. 上傳本資料夾的 `index.html`（其他檔案可一併上傳當備份）
3. 儲存庫 Settings → Pages → Branch 選 `main`、資料夾選 `/ (root)` → Save
4. 約一分鐘後網址生效：`https://msps00235.github.io/class/`

### 完成後

- 老師密碼預設 `happy404`，請立刻在網頁上「老師專區」登入 → 「修改密碼」換掉
- 老師第一次按儲存後，資料檔會自動出現在您的 Google 雲端硬碟
- 之後所有更新都直接在網頁上操作，不需要再碰 GitHub 或 Apps Script

## 注意事項

- 網頁內容任何人都看得到，請勿放成績、身分證字號等個資
- 修改網頁**功能或版面**時才需要更新 GitHub 上的 `index.html`；日常內容更新不用
- 若日後重新部署 Apps Script 產生了新網址，記得同步更新 `index.html` 的 `API_URL`
