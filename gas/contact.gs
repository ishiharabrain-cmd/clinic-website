// 脳と心の石原クリニック ホームページ「お問い合わせフォーム」の受け口
// Google Apps Script（ishihara.brain@gmail.com のアカウント）に貼り付けて、ウェブアプリとして公開する。
// 届いた内容を ishihara.brain@gmail.com にメールで送るだけで、どこにも保存しない。
//
// ロボット・AIによる自動投稿への対策（何重にもかけている）
//  1. Cloudflare Turnstile（人かどうかの確認）。秘密鍵は「プロジェクトの設定 → スクリプト プロパティ」に
//     TURNSTILE_SECRET という名前で入れる。このファイルには絶対に書かない（リポジトリは公開のため）。
//  2. 人には見えない入力欄（website）に入力があれば捨てる
//  3. ページを開いてから送信までが短すぎるもの（機械的な連続送信）は捨てる
//  4. リンク（URL）が1つでも入った投稿は受け付けない（宣伝・詐欺の迷惑投稿に多い）。
//     さらに、届くメールの中では、URLやドメインに見える文字をクリックできない形に崩して表示する
//  5. 1時間・1日あたりの受付件数に上限をかける（突破されても、届く量に天井がある）

const TO = 'ishihara.brain@gmail.com';
const MAX_PER_HOUR = 10;
const MAX_PER_DAY = 30;
const MIN_SECONDS_ON_PAGE = 5;

function doPost(e) {
  const p = (e && e.parameter) || {};

  if (p.website) return reply_('ok');

  const openedAt = Number(p.t || 0);
  if (!openedAt || Date.now() - openedAt < MIN_SECONDS_ON_PAGE * 1000) return reply_('ok');

  if (!verifyTurnstile_(p['cf-turnstile-response'])) return reply_('ng');

  const name = clip_(p.name, 100);
  const email = clip_(p.email, 200);
  const relation = clip_(p.relation, 50);
  const message = clip_(p.message, 3000);
  if (!name || !message) return reply_('ng');
  if ([name, relation, message].some(hasLink_)) return reply_('nolink'); // メールアドレス欄は除く（アドレスにはドメインが入るため）

  if (!underLimit_('hour', MAX_PER_HOUR, 3600) || !underLimit_('day', MAX_PER_DAY, 21600 * 4)) {
    return reply_('busy');
  }

  const body = [
    'ホームページのお問い合わせフォームから届きました。',
    '',
    'お名前：' + defang_(name),
    'メールアドレス：' + (email ? defang_(email) : '（記入なし）'),
    'ご関係：' + (relation ? defang_(relation) : '（記入なし）'),
    '',
    '内容：',
    defang_(message),
  ].join('\n');

  const options = { name: '脳と心の石原クリニック HP' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) options.replyTo = email;
  MailApp.sendEmail(TO, '【HPお問い合わせ】' + defang_(name) + ' 様', body, options);
  return reply_('ok');
}

function verifyTurnstile_(token) {
  const secret = PropertiesService.getScriptProperties().getProperty('TURNSTILE_SECRET');
  if (!secret) return false; // 秘密鍵が未設定のあいだは、どの投稿も受け付けない
  if (!token) return false;
  const res = UrlFetchApp.fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'post',
    payload: { secret: secret, response: token },
    muteHttpExceptions: true,
  });
  try {
    return JSON.parse(res.getContentText()).success === true;
  } catch (err) {
    return false;
  }
}

function underLimit_(key, max, seconds) {
  const lock = LockService.getScriptLock();
  lock.waitLock(5000);
  try {
    const cache = CacheService.getScriptCache();
    const n = Number(cache.get(key) || 0);
    if (n >= max) return false;
    cache.put(key, String(n + 1), seconds);
    return true;
  } finally {
    lock.releaseLock();
  }
}

// URLやドメイン名らしきものが含まれているか
function hasLink_(v) {
  const s = String(v || '');
  return /(https?:|ftp:|www\.|:\/\/)/i.test(s) ||
    /[a-z0-9-]+\.(com|net|org|jp|io|co|info|biz|xyz|top|link|site|online|ru|cn)\b/i.test(s);
}

// メールの中で自動的にリンクにならないよう、点やコロンを崩す（例：example.com → example[.]com）
function defang_(v) {
  return String(v || '')
    .replace(/:\/\//g, '[://]')
    .replace(/\./g, '[.]')
    .replace(/@/g, '[@]');
}

function clip_(v, n) {
  return String(v || '').trim().slice(0, n);
}

function reply_(s) {
  return ContentService.createTextOutput(s);
}
