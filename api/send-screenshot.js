// Vercel Serverless Function — POST /api/send-screenshot
// 1. 发截图邮件给卖家（含附件）
// 2. 发送成功后推送微信通知

const RESEND_API_KEY = process.env.RESEND_API_KEY || 're_YK9VBtAw_Madhj473KjfdAo86jDxm9BFX';
const SELLER_EMAIL   = process.env.SELLER_EMAIL   || 'roomyu0303@gmail.com';
const SCTKEY         = process.env.SCTKEY         || 'SCT349248TooWVfEdWL7TKF9xp4iVag1OK';
// ⚠️  免费版 onboarding@resend.dev 只能发到 Resend 注册邮箱
// 解决方案：收件人改为 Resend 注册邮箱（环境变量 RESEND_OWNER_EMAIL），
// 如未配置则回退到 SELLER_EMAIL（需确保与 Resend 账号邮箱一致）
const FROM_EMAIL       = process.env.FROM_EMAIL       || 'AI Translator <onboarding@resend.dev>';
const RESEND_OWNER_EMAIL = process.env.RESEND_OWNER_EMAIL || SELLER_EMAIL;

const LICENSE_KEYS = [
  'AITX-A7K9-M3R6-P2W8', 'AITX-B4J2-N8Q5-L1T7', 'AITX-C6H3-V9X4-K7M2',
  'AITX-D1F8-Z5Y7-J4N6', 'AITX-E9G2-W6R3-H8Q1', 'AITX-F3K7-T4P9-M6V2',
  'AITX-G8L5-X2N7-R9W4', 'AITX-H2M6-Q8K3-P5T1', 'AITX-J7N4-V3L9-X6R8',
  'AITX-K1P9-M5W2-N7Q4', 'AITX-L5Q3-R8T6-W2X9', 'AITX-M9V7-K4N2-P6J8',
  'AITX-N3W5-L9Q7-T4R1', 'AITX-P8X2-M6V4-K9N3', 'AITX-Q4R7-N2W8-L5P6',
  'AITX-R1T9-P7X3-M8Q2', 'AITX-S6V4-K8R2-N9W5', 'AITX-T2W6-L4P9-Q7V3',
  'AITX-U9X5-M3T8-R6K1', 'AITX-V3Y7-N9W4-P2L8', 'AITX-W8Z2-Q6X5-T4M9',
  'AITX-X4A6-R9K3-V7N2', 'AITX-Y7B9-P2L5-W8Q4', 'AITX-Z1C8-M6T3-X9R7',
  'AITX-A3D5-N8V2-K4P9', 'AITX-B9E2-Q7W4-L6T8', 'AITX-C5F7-R3X9-M2N6',
  'AITX-D8G4-P6K2-V9Q3', 'AITX-E2H9-T5L7-W4X8', 'AITX-F6J3-M8R2-N9P5',
  'AITX-G1K8-Q4V6-T7W2', 'AITX-H7L4-X9N3-R5M8', 'AITX-J3M6-K2P8-W9Q4',
  'AITX-K9N2-L7T5-V3X6', 'AITX-L4P8-M9R6-Q2W7', 'AITX-M6Q3-N5V9-T8X2',
  'AITX-N8R5-P4W7-K9L3', 'AITX-P2T9-Q8X4-M6V7', 'AITX-Q7V6-R3N8-W5P2',
  'AITX-R4W8-T9K5-L7Q3', 'AITX-S9X3-V6M2-N8R4', 'AITX-T5Y8-W4P7-Q9K6',
  'AITX-U2Z6-X9L3-R5T8', 'AITX-V8A4-N7M9-P6W2', 'AITX-W3B7-Q5X8-T2K9',
  'AITX-X9C2-R6V4-M8L3', 'AITX-Y5D8-P3W7-N9Q4', 'AITX-Z2E6-T8K5-L4X9',
  'AITX-A8F3-M9R7-V6P2', 'AITX-B4G9-N6Q3-W8T5',
];

function pickRandomKey() {
  return LICENSE_KEYS[Math.floor(Math.random() * LICENSE_KEYS.length)];
}

async function sendEmail(to, subject, html, attachments) {
  const payload = { from: FROM_EMAIL, to: Array.isArray(to) ? to : [to], subject, html };
  if (attachments) {
    payload.attachments = attachments.map(a => ({
      filename: a.filename,
      content:  a.content.replace(/^data:[^;]+;base64,/, ''),
    }));
  }
  const r = await fetch('https://api.resend.com/emails', {
    method:  'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_API_KEY, 'Content-Type': 'application/json' },
    body:    JSON.stringify(payload),
  });
  const text = await r.text();
  let body;
  try { body = JSON.parse(text); } catch(e) { body = { _raw: text || r.statusText }; }
  if (!r.ok) console.error('Resend error', r.status, JSON.stringify(body));
  return { ok: r.ok, status: r.status, body };
}

// Vercel Serverless 不会自动解析 body，需要手动读取流
function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let data = '';
    req.on('data', chunk => { data += chunk; });
    req.on('end', () => {
      try { resolve(JSON.parse(data)); } catch(e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  try {
    const { email, imageBase64, imageMime, fileName } = await readBody(req);
    if (!email || !imageBase64) {
      return res.status(400).json({ error: '缺少必要参数 email 或 imageBase64' });
    }

    const now          = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
    const safeFileName = fileName || 'screenshot.jpg';
    const licenseKey   = pickRandomKey();

    // ── 1. 发截图邮件给卖家 ─────────────────────────────────
    const sellerHtml =
      '<div style="font-family:sans-serif;padding:24px;max-width:560px">'
      + '<h2 style="color:#6366f1;margin:0 0 16px">🎉 新用户付款通知</h2>'
      + '<p><b>用户邮箱：</b>' + email + '</p>'
      + '<p><b>提交时间：</b>' + now + '</p>'
      + '<p><b>已分配 Key：</b><code style="background:#f0f1ff;padding:2px 6px;border-radius:4px;color:#6366f1;font-size:15px">' + licenseKey + '</code></p>'
      + '<p style="color:#64748b;font-size:13px">截图见附件，请核对后手动回复 Key 给用户。</p>'
      + '</div>';

    const sellerResult = await sendEmail(
      RESEND_OWNER_EMAIL,   // ← 必须是 Resend 账号注册邮箱（免费版限制）
      '💰 AI Translator 新付款截图 — ' + email,
      sellerHtml,
      [{ filename: safeFileName, content: imageBase64 }]
    );

    if (!sellerResult.ok) {
      const resendMsg = sellerResult.body?.message || sellerResult.body?.name || JSON.stringify(sellerResult.body);
      return res.status(500).json({
        error:  '邮件发送失败（Resend ' + sellerResult.status + '）',
        detail: resendMsg,
      });
    }

    // ── 2. 微信通知（邮件成功后） ───────────────────────────
    fetch('https://sctapi.ftqq.com/' + SCTKEY + '.send', {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    'title=' + encodeURIComponent('✅ 新付款截图已收到！') +
               '&desp=' + encodeURIComponent(
                 '**买家邮箱：** ' + email + '\n\n' +
                 '**分配的 Key：** `' + licenseKey + '`\n\n' +
                 '**时间：** ' + now
               ),
    }).catch(() => {});

    return res.status(200).json({ success: true, key: licenseKey });

  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ error: '服务器错误', detail: err.message });
  }
}
