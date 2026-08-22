// ═══════════════════════════════════════════════════════════
//  班級網頁 資料後端（Google Apps Script）
//
//  一個後端服務所有學年：網頁會帶「學年代號」（site）來讀寫，
//  每個學年的資料各存成雲端硬碟裡的一個檔案，互不影響。
//    例：學年代號 115-404 → 檔名 class-data-115-404.json
//
//  老師密碼存在「指令碼屬性」，所有學年共用，換一次全部生效。
// ═══════════════════════════════════════════════════════════

// 資料檔名的開頭（完整檔名＝這個開頭＋學年代號＋.json）
var FILE_PREFIX = 'class-data-';

// ─────────────────────────────────────────────
//  初次設定：部署前執行一次
//  把老師密碼初始化為 happy404，之後請在網頁上「修改密碼」換掉
// ─────────────────────────────────────────────
function 初次設定() {
  PropertiesService.getScriptProperties().setProperty('TEACHER_PW', 'happy404');
}

// ─────────────────────────────────────────────
//  讀取資料：網頁載入時呼叫
//  GET …/exec?site=115-404 → 回傳該學年的資料（還沒有資料時回傳 null）
// ─────────────────────────────────────────────
function doGet(e) {
  var site = cleanSite(e && e.parameter && e.parameter.site);
  var file = findDataFile(site);
  var body = file ? file.getBlob().getDataAsString() : 'null';
  return jsonText(body);
}

// ─────────────────────────────────────────────
//  寫入：老師在網頁上按儲存時呼叫
//  POST 內容為 JSON：
//    儲存資料　{ action:'save',  site, pw, data }
//    修改密碼　{ action:'setpw', site, pw, newPw }
//  密碼不對一律回 { ok:false, error:'bad_pw' }
// ─────────────────────────────────────────────
function doPost(e) {
  var lock = LockService.getScriptLock(); // 避免同時寫入互相覆蓋
  lock.waitLock(10000);
  try {
    var req = JSON.parse(e.postData.contents);
    var props = PropertiesService.getScriptProperties();
    var teacherPw = props.getProperty('TEACHER_PW');

    if (!teacherPw || req.pw !== teacherPw) {
      return jsonReply({ ok: false, error: 'bad_pw' });
    }

    if (req.action === 'setpw' && req.newPw) {
      props.setProperty('TEACHER_PW', String(req.newPw));
      return jsonReply({ ok: true });
    }

    if (req.action === 'save' && req.data) {
      saveData(cleanSite(req.site), req.data);
      return jsonReply({ ok: true });
    }

    return jsonReply({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────
//  小工具
// ─────────────────────────────────────────────

// 整理學年代號：只留英數、底線、連字號；空白時用 default
function cleanSite(raw) {
  var site = String(raw || '').replace(/[^A-Za-z0-9_-]/g, '');
  return site || 'default';
}

// 找出某學年的資料檔（不存在時回傳 null）
function findDataFile(site) {
  var it = DriveApp.getFilesByName(FILE_PREFIX + site + '.json');
  return it.hasNext() ? it.next() : null;
}

// 寫入某學年的資料（第一次會自動建檔）
function saveData(site, data) {
  var text = JSON.stringify(data);
  var file = findDataFile(site);
  if (file) file.setContent(text);
  else DriveApp.createFile(FILE_PREFIX + site + '.json', text, 'application/json');
}

// 把物件包成 JSON 回應
function jsonReply(obj) {
  return jsonText(JSON.stringify(obj));
}

function jsonText(text) {
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
