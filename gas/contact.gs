// 脳と心の石原クリニック ホームページ「お問い合わせフォーム」の受け口
// Google Apps Script（ishihara.brain@gmail.com のアカウント）に貼り付けて、ウェブアプリとして公開する。
// 届いた内容を ishihara.brain@gmail.com にメールで送る。返信すると、送ってきた人のメールアドレスに返る。

const TO = 'ishihara.brain@gmail.com';
const MAX_PER_HOUR = 20; // いたずら対策：1時間に受け付ける上限

function doPost(e) {
  const p = (e && e.parameter) || {};
  if (p.website) return reply_('ok'); // 機械による迷惑投稿（人には見えない欄に入力がある）は捨てる

  const name = clip_(p.name, 100);
  const email = clip_(p.email, 200);
  const relation = clip_(p.relation, 50);
  const message = clip_(p.message, 4000);
  if (!name || !message) return reply_('ng');

  const cache = CacheService.getScriptCache();
  const count = Number(cache.get('count') || 0);
  if (count >= MAX_PER_HOUR) return reply_('busy');
  cache.put('count', String(count + 1), 3600);

  const body = [
    'ホームページのお問い合わせフォームから届きました。',
    '',
    'お名前：' + name,
    'メールアドレス：' + (email || '（記入なし）'),
    'ご関係：' + (relation || '（記入なし）'),
    '',
    '内容：',
    message,
  ].join('\n');

  const options = { name: '脳と心の石原クリニック HP' };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) options.replyTo = email;
  MailApp.sendEmail(TO, '【HPお問い合わせ】' + name + ' 様', body, options);
  return reply_('ok');
}

function clip_(v, n) {
  return String(v || '').trim().slice(0, n);
}

function reply_(s) {
  return ContentService.createTextOutput(s);
}
