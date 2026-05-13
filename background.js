const API_CONFIG = {
  baseUrl: 'https://api.openai.com/v1/chat/completions',
  model: 'gpt-3.5-turbo',
  apiKey: ''
};

// ─── License / Usage Config ───────────────────────────────────────────────
const FREE_DAILY_LIMIT = 20; // free tier: 20 translations per day

// NOTE: Replace this URL with your actual license verification endpoint.
// The endpoint should accept POST { licenseKey, action: 'activate' | 'verify' }
// and return { valid: true/false, message?: string }
const LICENSE_VERIFY_URL = 'https://your-license-server.com/api/verify';

chrome.runtime.onInstalled.addListener(() => {
  createContextMenu();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.action) {
    case 'translate':
      handleTranslateWithQuota(message.text, message.sourceLang, message.targetLang)
        .then(sendResponse);
      return true;

    case 'getSettings':
      getSettings().then(sendResponse);
      return true;

    case 'saveSettings':
      saveSettings(message.settings).then(sendResponse);
      return true;

    case 'getLicenseStatus':
      getLicenseStatus().then(sendResponse);
      return true;

    case 'activateLicense':
      activateLicense(message.licenseKey).then(sendResponse);
      return true;

    case 'getUsage':
      getUsage().then(sendResponse);
      return true;
  }
});

// ─── Quota-aware translate wrapper ───────────────────────────────────────

async function handleTranslateWithQuota(text, sourceLang, targetLang) {
  const license = await getLicenseStatus();

  if (!license.activated) {
    // Check daily usage for free tier
    const usage = await getUsage();
    if (usage.todayCount >= FREE_DAILY_LIMIT) {
      return {
        success: false,
        quotaExceeded: true,
        error: `免费额度已用完（${FREE_DAILY_LIMIT}次/天），请激活完整版后无限使用。`
      };
    }
    // Increment count before translating
    await incrementUsage();
  }

  return handleTranslate(text, sourceLang, targetLang);
}

// ─── Usage counter (resets daily) ────────────────────────────────────────

async function getUsage() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['usage'], (result) => {
      const today = new Date().toDateString();
      const usage = result.usage || {};
      if (usage.date !== today) {
        resolve({ todayCount: 0, date: today });
      } else {
        resolve(usage);
      }
    });
  });
}

async function incrementUsage() {
  const usage = await getUsage();
  const today = new Date().toDateString();
  return new Promise((resolve) => {
    chrome.storage.local.set({
      usage: { date: today, todayCount: (usage.todayCount || 0) + 1 }
    }, resolve);
  });
}

// ─── License management ───────────────────────────────────────────────────

async function getLicenseStatus() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['license'], (result) => {
      resolve(result.license || { activated: false, key: '' });
    });
  });
}

async function activateLicense(licenseKey) {
  if (!licenseKey || licenseKey.trim().length < 8) {
    return { success: false, message: 'License Key 格式不正确' };
  }

  const key = licenseKey.trim().toUpperCase();

  try {
    // ── Try remote verification first ──
    const response = await fetch(LICENSE_VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ licenseKey: key, action: 'activate' }),
      signal: AbortSignal.timeout(6000)
    });

    if (response.ok) {
      const data = await response.json();
      if (data.valid) {
        await saveLicense(key);
        return { success: true, message: '激活成功！感谢支持 🎉' };
      } else {
        return { success: false, message: data.message || 'License Key 无效，请检查后重试。' };
      }
    }
    // Server error — fall through to offline check
  } catch (_) {
    // Network unavailable — fall through to offline check
  }

  // ── Offline fallback: validate key format / checksum locally ──
  // Format: AITX-XXXX-XXXX-XXXX (prefix + 3 groups of 4 alphanum)
  const offlineValid = /^AITX-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(key);
  if (offlineValid) {
    await saveLicense(key);
    return { success: true, message: '激活成功（离线模式）🎉' };
  }

  return { success: false, message: '无法连接验证服务器，且 Key 格式不符，请检查网络或 Key 是否正确。' };
}

async function saveLicense(key) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ license: { activated: true, key, activatedAt: Date.now() } }, resolve);
  });
}

async function handleTranslate(text, sourceLang, targetLang) {
  try {
    const settings = await getSettings();
    const provider = settings.apiProvider || 'free';

    // Route to free MyMemory API if selected
    if (provider === 'free') {
      return await handleFreeTranslate(text, sourceLang, targetLang);
    }

    const config = { ...API_CONFIG, ...settings };
    const { apiKey, baseUrl, model } = config;

    if (!apiKey) {
      return { success: false, error: 'API key not configured. Please open Settings (⚙️) to add your API key.' };
    }

    const prompt = buildTranslationPrompt(text, sourceLang, targetLang);

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: 'system',
            content: 'You are a professional translator. Translate the given text accurately while preserving tone, context, and nuance. Only output the translation, nothing else.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      let errorMsg = `API error: ${response.status}`;
      try {
        const errorData = await response.json();
        errorMsg =
          errorData?.error?.message ||
          errorData?.message ||
          errorData?.error ||
          errorMsg;

        if (response.status === 402 || (typeof errorMsg === 'string' && /insufficient.balance|balance|quota|credit/i.test(errorMsg))) {
          errorMsg = '余额不足 (Insufficient Balance)。请前往平台充值后再试。';
        } else if (response.status === 401) {
          errorMsg = 'API Key 无效或已过期，请在设置中检查 Key 是否正确。';
        } else if (response.status === 429) {
          errorMsg = '请求频率过高，请稍后再试 (Rate limit exceeded)。';
        } else if (response.status === 403) {
          errorMsg = 'API Key 无访问权限，请检查 Key 的权限设置。';
        }
      } catch (_) { /* keep default errorMsg */ }

      return { success: false, error: errorMsg };
    }

    const data = await response.json();
    const translation = data.choices?.[0]?.message?.content?.trim();

    if (!translation) {
      return { success: false, error: 'Empty response from AI' };
    }

    return { success: true, text: translation };

  } catch (error) {
    return { success: false, error: error.message || 'Translation failed' };
  }
}

// Detect whether text is primarily Chinese
function isChinese(text) {
  const chineseChars = (text.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length;
  return chineseChars / text.length > 0.2;
}

// MyMemory free translation API (no key required, ~5000 words/day)
async function handleFreeTranslate(text, sourceLang, targetLang) {
  try {
    const LANG_MAP = {
      'en': 'en',
      'zh': 'zh-CN',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'ru': 'ru'
    };

    // When sourceLang is 'auto', detect actual language to pick the right target
    let resolvedSrc = 'en';
    let resolvedTgt = 'zh-CN';

    if (sourceLang === 'auto') {
      if (isChinese(text)) {
        // Chinese input → translate to English
        resolvedSrc = 'zh-CN';
        resolvedTgt = 'en';
      } else {
        // Non-Chinese input → translate to Chinese
        // Try to detect language via a small probe (just use 'en' as fallback src)
        resolvedSrc = 'en';
        resolvedTgt = 'zh-CN';
      }
    } else {
      resolvedSrc = (sourceLang in LANG_MAP) ? LANG_MAP[sourceLang] : sourceLang;
      resolvedTgt = (targetLang in LANG_MAP) ? LANG_MAP[targetLang] : targetLang;
      // Guard: MyMemory rejects identical src/tgt
      if (resolvedSrc === resolvedTgt) {
        resolvedTgt = resolvedSrc.startsWith('zh') ? 'en' : 'zh-CN';
      }
    }

    const langpair = `${resolvedSrc}|${resolvedTgt}`;

    // MyMemory has a 500-char limit per request; split if needed
    const chunks = splitText(text, 480);
    const results = [];

    for (const chunk of chunks) {
      const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(chunk)}&langpair=${encodeURIComponent(langpair)}`;
      const response = await fetch(url);

      if (!response.ok) {
        return { success: false, error: `Free API error: ${response.status}` };
      }

      const data = await response.json();

      if (data.responseStatus !== 200) {
        const msg = data.responseDetails || data.responseStatus;
        if (String(msg).includes('QUERY LENGTH LIMIT') || data.responseStatus === 429) {
          return { success: false, error: '免费翻译今日额度已用完，请明天再试或切换到付费 API。' };
        }
        return { success: false, error: `翻译失败: ${msg}` };
      }

      results.push(data.responseData.translatedText);
    }

    return { success: true, text: results.join(' ') };

  } catch (error) {
    return { success: false, error: `免费翻译请求失败: ${error.message}` };
  }
}

// Split long text into chunks at sentence boundaries
function splitText(text, maxLen) {
  if (text.length <= maxLen) return [text];
  const chunks = [];
  let remaining = text;
  while (remaining.length > 0) {
    if (remaining.length <= maxLen) {
      chunks.push(remaining);
      break;
    }
    // Find last sentence break within maxLen
    let cutAt = maxLen;
    const breakChars = ['. ', '! ', '? ', '。', '！', '？', '\n'];
    for (const br of breakChars) {
      const idx = remaining.lastIndexOf(br, maxLen);
      if (idx > 0) { cutAt = idx + br.length; break; }
    }
    chunks.push(remaining.slice(0, cutAt).trim());
    remaining = remaining.slice(cutAt).trim();
  }
  return chunks;
}

function buildTranslationPrompt(text, sourceLang, targetLang) {
  const langNames = {
    'auto': 'auto-detect',
    'en': 'English',
    'zh': 'Chinese',
    'ja': 'Japanese',
    'ko': 'Korean',
    'fr': 'French',
    'de': 'German',
    'es': 'Spanish',
    'ru': 'Russian'
  };

  const source = sourceLang === 'auto' ? 'auto-detect the language' : langNames[sourceLang] || sourceLang;
  const target = langNames[targetLang] || targetLang;

  return `Translate the following text from ${source} to ${target}:

---
${text}
---

Provide only the translation, no explanations or additional text.`;
}

async function getSettings() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['settings'], (result) => {
      resolve(result.settings || {});
    });
  });
}

async function saveSettings(settings) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ settings }, () => {
      resolve({ success: true });
    });
  });
}

function createContextMenu() {
  chrome.contextMenus.create({
    id: 'translate-selection',
    title: 'Translate with AI',
    contexts: ['selection']
  });
}

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'translate-selection' && info.selectionText) {
    chrome.storage.local.set({ selectedText: info.selectionText });
    chrome.action.openPopup();
  }
});
