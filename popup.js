document.addEventListener('DOMContentLoaded', () => {
  const inputText = document.getElementById('inputText');
  const outputText = document.getElementById('outputText');
  const translateBtn = document.getElementById('translateBtn');
  const clearBtn = document.getElementById('clearBtn');
  const copySourceBtn = document.getElementById('copySourceBtn');
  const copyTargetBtn = document.getElementById('copyTargetBtn');
  const swapBtn = document.getElementById('swapBtn');
  const settingsBtn = document.getElementById('settingsBtn');
  const charCount = document.getElementById('charCount');
  const historyList = document.getElementById('historyList');
  const sourceLang = document.getElementById('sourceLang');
  const targetLang = document.getElementById('targetLang');

  const MAX_CHARS = 5000;

  // Load saved settings
  loadSettings();

  // Load history
  loadHistory();

  // Check for context-menu selected text first, then clipboard
  loadInitialText();

  // Character count
  inputText.addEventListener('input', () => {
    const len = inputText.value.length;
    charCount.textContent = `${len}/${MAX_CHARS}`;
    charCount.style.color = len > MAX_CHARS ? 'var(--warning)' : 'var(--text-tertiary)';
  });

  // Translate
  translateBtn.addEventListener('click', handleTranslate);

  // Enter to translate (Ctrl/Cmd + Enter)
  inputText.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      handleTranslate();
    }
  });

  // Clear
  clearBtn.addEventListener('click', () => {
    inputText.value = '';
    outputText.innerHTML = '<span class="output-placeholder">Translation will appear here...</span>';
    charCount.textContent = `0/${MAX_CHARS}`;
    inputText.focus();
  });

  // Copy source
  copySourceBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(inputText.value);
    showTooltip(copySourceBtn, 'Copied!');
  });

  // Copy target
  copyTargetBtn.addEventListener('click', () => {
    const text = outputText.querySelector('.output-text');
    if (text) {
      navigator.clipboard.writeText(text.textContent);
      showTooltip(copyTargetBtn, 'Copied!');
    }
  });

  // Swap languages
  swapBtn.addEventListener('click', () => {
    if (sourceLang.value === 'auto') return;
    const temp = sourceLang.value;
    sourceLang.value = targetLang.value;
    targetLang.value = temp;
  });

  // Settings
  settingsBtn.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });


  async function handleTranslate() {
    const text = inputText.value.trim();
    if (!text) return;

    if (text.length > MAX_CHARS) {
      showToast('Text exceeds maximum length');
      return;
    }

    setLoading(true);

    try {
      const result = await chrome.runtime.sendMessage({
        action: 'translate',
        text,
        sourceLang: sourceLang.value,
        targetLang: targetLang.value
      });

      if (result.success) {
        outputText.innerHTML = `<div class="output-text">${escapeHtml(result.text)}</div>`;
        addToHistory(text, result.text, sourceLang.value, targetLang.value);
      } else {
        outputText.innerHTML = `<div class="output-text" style="color: var(--warning)">Error: ${result.error || 'Translation failed'}</div>`;
      }
    } catch (error) {
      outputText.innerHTML = `<div class="output-text" style="color: var(--warning)">Error: ${error.message}</div>`;
    } finally {
      setLoading(false);
    }
  }

  function setLoading(loading) {
    translateBtn.disabled = loading;
    translateBtn.classList.toggle('loading', loading);
  }

  async function loadSettings() {
    const result = await chrome.storage.local.get(['settings']);
    if (result.settings) {
      const { defaultSource, defaultTarget } = result.settings;
      if (defaultSource) sourceLang.value = defaultSource;
      if (defaultTarget) targetLang.value = defaultTarget;
    }
  }

  async function loadHistory() {
    const result = await chrome.storage.local.get(['history']);
    const history = result.history || [];
    
    if (history.length === 0) {
      historyList.innerHTML = '<div class="history-empty">No recent translations</div>';
      return;
    }

    historyList.innerHTML = history.slice(0, 5).map(item => `
      <div class="history-item" data-source="${escapeHtml(item.source)}" data-target="${escapeHtml(item.target)}">
        <div class="history-source">${escapeHtml(item.source)}</div>
        <div class="history-target">${escapeHtml(item.target)}</div>
      </div>
    `).join('');

    // Click to restore
    historyList.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        inputText.value = item.dataset.source;
        outputText.innerHTML = `<div class="output-text">${escapeHtml(item.dataset.target)}</div>`;
        charCount.textContent = `${inputText.value.length}/${MAX_CHARS}`;
      });
    });
  }

  async function addToHistory(source, target, sourceLang, targetLang) {
    const result = await chrome.storage.local.get(['history']);
    const history = result.history || [];
    
    history.unshift({
      source,
      target,
      sourceLang,
      targetLang,
      timestamp: Date.now()
    });

    await chrome.storage.local.set({ history: history.slice(0, 20) });
    loadHistory();
  }

  async function loadInitialText() {
    // Priority 1: context-menu selected text
    try {
      const result = await chrome.storage.local.get(['selectedText']);
      if (result.selectedText && result.selectedText.trim()) {
        inputText.value = result.selectedText;
        charCount.textContent = `${inputText.value.length}/${MAX_CHARS}`;
        // Clear it so it doesn't persist on next open
        await chrome.storage.local.remove(['selectedText']);
        handleTranslate();
        return;
      }
    } catch (e) { /* ignore */ }

    // Priority 2: clipboard text (only pre-fill, don't auto-translate)
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim().length > 0 && text.length <= MAX_CHARS) {
        inputText.value = text;
        charCount.textContent = `${text.length}/${MAX_CHARS}`;
      }
    } catch (e) {
      // Clipboard permission denied or empty, ignore
    }
  }


  function showTooltip(btn, text) {
    const original = btn.title;
    btn.title = text;
    setTimeout(() => btn.title = original, 1500);
  }

  function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      bottom: 16px;
      left: 50%;
      transform: translateX(-50%);
      background: var(--bg-elevated);
      color: var(--text-primary);
      padding: 8px 16px;
      border-radius: 8px;
      font-size: 12px;
      z-index: 1000;
      animation: fadeIn 0.2s ease-out;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2000);
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
});
