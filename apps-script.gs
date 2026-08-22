// ═══════════════════════════════════════════════
//  404快樂窩 班級網頁 — 資料後端（Google Apps Script）
//  功能：儲存/提供班級資料、驗證老師密碼
//  資料存放：您的 Google 雲端硬碟（檔名 class404-data.json）
// ═══════════════════════════════════════════════

var FILE_NAME = 'class404-data.json';

// ① 部署前先執行一次這個函式（上方選單選「初次設定」→ 執行）
//    會把老師密碼設為 happy404，之後請在網頁上用「修改密碼」換掉
function 初次設定() {
  PropertiesService.getScriptProperties().setProperty('TEACHER_PW', 'happy404');
}

// 讀取資料（網頁載入時呼叫）
function doGet() {
  var f = findFile();
  var body = f ? f.getBlob().getDataAsString() : 'null';
  return ContentService.createTextOutput(body)
    .setMimeType(ContentService.MimeType.JSON);
}

// 儲存資料 / 修改密碼（老師在網頁上按儲存時呼叫）
function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var req = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var pw = props.getProperty('TEACHER_PW');
    if (!pw || req.pw !== pw) return json({ ok: false, error: 'bad_pw' });

    if (req.action === 'setpw' && req.newPw) {
      props.setProperty('TEACHER_PW', String(req.newPw));
      return json({ ok: true });
    }
    if (req.action === 'save' && req.data) {
      var text = JSON.stringify(req.data);
      var f = findFile();
      if (f) f.setContent(text);
      else DriveApp.createFile(FILE_NAME, text, 'application/json');
      return json({ ok: true });
    }
    return json({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}

function findFile() {
  var it = DriveApp.getFilesByName(FILE_NAME);
  return it.hasNext() ? it.next() : null;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
