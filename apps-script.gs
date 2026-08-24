// ═══════════════════════════════════════════════════════════
//  班級網頁 資料後端（Google Apps Script）
//
//  一個後端服務所有學年：網頁會帶「學年代號」（site）來讀寫，
//  每個學年的資料各存一個檔案，互不影響。
//
//  雲端硬碟的擺放位置（第一次使用時自動建立）：
//    class/                     ← 網頁所有資料都在這裡
//    ├─ class-data-115-404.json ← 各學年的班級資料
//    └─ 附件/                   ← 老師上傳的消息附件
//
//  老師密碼存在「指令碼屬性」，所有學年共用，換一次全部生效。
// ═══════════════════════════════════════════════════════════

var ROOT_FOLDER = 'class';    // 雲端硬碟裡的主資料夾名稱
var ATTACH_FOLDER = '附件';   // 附件子資料夾名稱
var BACKUP_FOLDER = '備份';   // 每日快照子資料夾名稱
var BACKUP_KEEP = 30;         // 快照保留天數
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
//  寫入：老師在網頁上操作時呼叫
//  POST 內容為 JSON：
//    儲存資料　{ action:'save',   site, pw, data }
//    修改密碼　{ action:'setpw',  site, pw, newPw }
//    上傳附件　{ action:'upload', site, pw, name, mime, data64 }
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
      var site = cleanSite(req.site);
      var text = JSON.stringify(req.data);
      saveData(site, text);
      writeBackup(site, text); // 每次儲存自動留當天快照
      return jsonReply({ ok: true });
    }

    if (req.action === 'upload' && req.data64 && req.name) {
      return jsonReply(uploadAttachment(req));
    }

    if (req.action === 'listbackups') {
      return jsonReply({ ok: true, backups: listBackups(cleanSite(req.site)) });
    }

    if (req.action === 'restore' && req.name) {
      return jsonReply(restoreBackup(cleanSite(req.site), String(req.name)));
    }

    return jsonReply({ ok: false, error: 'bad_request' });
  } finally {
    lock.releaseLock();
  }
}

// ─────────────────────────────────────────────
//  附件上傳：存進 class/附件，並設成「知道連結的人可檢視」
//  學校帳號若禁止公開共用，仍會上傳成功，但回傳 shared:false 提醒老師
// ─────────────────────────────────────────────
function uploadAttachment(req) {
  var bytes = Utilities.base64Decode(String(req.data64));
  var blob = Utilities.newBlob(bytes, String(req.mime || 'application/octet-stream'), String(req.name));
  var file = attachFolder().createFile(blob);
  var shared = true;
  try {
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  } catch (err) {
    shared = false;
  }
  return {
    ok: true,
    name: file.getName(),
    url: 'https://drive.google.com/file/d/' + file.getId() + '/view',
    shared: shared
  };
}

// ─────────────────────────────────────────────
//  資料夾與檔案
// ─────────────────────────────────────────────

// 主資料夾 class（在雲端硬碟最上層，不存在就建立）
function rootFolder() {
  var it = DriveApp.getRootFolder().getFoldersByName(ROOT_FOLDER);
  return it.hasNext() ? it.next() : DriveApp.getRootFolder().createFolder(ROOT_FOLDER);
}

// 附件子資料夾 class/附件
function attachFolder() {
  var root = rootFolder();
  var it = root.getFoldersByName(ATTACH_FOLDER);
  return it.hasNext() ? it.next() : root.createFolder(ATTACH_FOLDER);
}

// 找出某學年的資料檔；早期存在最上層的檔案會自動搬進 class 資料夾
function findDataFile(site) {
  var name = FILE_PREFIX + site + '.json';
  var folder = rootFolder();
  var it = folder.getFilesByName(name);
  if (it.hasNext()) return it.next();
  var anywhere = DriveApp.getFilesByName(name);
  if (anywhere.hasNext()) {
    var file = anywhere.next();
    file.moveTo(folder);
    return file;
  }
  return null;
}

// 寫入某學年的資料（第一次會自動建檔）
function saveData(site, text) {
  var file = findDataFile(site);
  if (file) file.setContent(text);
  else rootFolder().createFile(FILE_PREFIX + site + '.json', text, 'application/json');
}

// ─────────────────────────────────────────────
//  每日快照備份（class/備份/backup-<site>-YYYY-MM-DD.json）
// ─────────────────────────────────────────────

function backupFolder() {
  var root = rootFolder();
  var it = root.getFoldersByName(BACKUP_FOLDER);
  return it.hasNext() ? it.next() : root.createFolder(BACKUP_FOLDER);
}

function backupNameRe(site) {
  return new RegExp('^backup-' + site + '-\\d{4}-\\d{2}-\\d{2}\\.json$');
}

// 寫入（或覆蓋）當天的快照，並清掉過期的
function writeBackup(site, text) {
  var folder = backupFolder();
  var name = 'backup-' + site + '-' +
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd') + '.json';
  var it = folder.getFilesByName(name);
  if (it.hasNext()) it.next().setContent(text);
  else folder.createFile(name, text, 'application/json');
  cleanupBackups(folder, site);
}

// 只保留最近 BACKUP_KEEP 天的快照
function cleanupBackups(folder, site) {
  var re = backupNameRe(site);
  var files = folder.getFiles();
  var arr = [];
  while (files.hasNext()) {
    var f = files.next();
    if (re.test(f.getName())) arr.push(f);
  }
  arr.sort(function(a, b) { return a.getName() < b.getName() ? 1 : -1; }); // 新→舊
  for (var i = BACKUP_KEEP; i < arr.length; i++) arr[i].setTrashed(true);
}

// 快照檔名清單（新→舊）
function listBackups(site) {
  var re = backupNameRe(site);
  var files = backupFolder().getFiles();
  var names = [];
  while (files.hasNext()) {
    var n = files.next().getName();
    if (re.test(n)) names.push(n);
  }
  names.sort().reverse();
  return names;
}

// 還原某天的快照；還原前先把「現在的狀態」存成今天的快照，永遠有路可退
function restoreBackup(site, name) {
  if (!backupNameRe(site).test(name)) return { ok: false, error: 'bad_request' };
  var it = backupFolder().getFilesByName(name);
  if (!it.hasNext()) return { ok: false, error: 'not_found' };
  var text = it.next().getBlob().getDataAsString();
  var parsed = null;
  try { parsed = JSON.parse(text); } catch (e) {}
  if (!parsed || !parsed.news || !parsed.schedule) return { ok: false, error: 'bad_backup' };
  var live = findDataFile(site);
  if (live) writeBackup(site, live.getBlob().getDataAsString());
  saveData(site, text);
  return { ok: true };
}

// ─────────────────────────────────────────────
//  小工具
// ─────────────────────────────────────────────

// 整理學年代號：只留英數、底線、連字號；空白時用 default
function cleanSite(raw) {
  var site = String(raw || '').replace(/[^A-Za-z0-9_-]/g, '');
  return site || 'default';
}

function jsonReply(obj) {
  return jsonText(JSON.stringify(obj));
}

function jsonText(text) {
  return ContentService.createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}
