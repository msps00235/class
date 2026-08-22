// ═══════════════════════════════════════════════
//  班級網頁 資料後端（Google Apps Script）
//  支援多學年：每個學年代號（site）各存一個資料檔
//  資料存放：您的 Google 雲端硬碟（class-data-<學年代號>.json）
// ═══════════════════════════════════════════════

// ① 部署前先執行一次這個函式（上方選單選「初次設定」→ 執行）
//    會把老師密碼設為 happy404，之後請在網頁上用「修改密碼」換掉
//    （密碼所有學年共用，換一次全部生效）
function 初次設定() {
  PropertiesService.getScriptProperties().setProperty('TEACHER_PW', 'happy404');
}

// 依學年代號決定資料檔名；沒給代號時沿用舊檔名（相容早期版本）
function fileNameFor(site) {
  site = String(site || '').replace(/[^A-Za-z0-9_-]/g, '');
  return site ? 'class-data-' + site + '.json' : 'class404-data.json';
}

// 讀取資料（網頁載入時呼叫，例：…/exec?site=115-404）
function doGet(e) {
  var f = findFile(fileNameFor(e && e.parameter && e.parameter.site));
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
      var name = fileNameFor(req.site);
      var text = JSON.stringify(req.data);
      var f = findFile(name);
      if (f) f.setContent(text);
      else DriveApp.createFile(name, text, 'application/json');
      return json({ ok: true });
    }
    return json({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}

function findFile(name) {
  var it = DriveApp.getFilesByName(name);
  return it.hasNext() ? it.next() : null;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
