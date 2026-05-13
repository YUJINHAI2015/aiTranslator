(function() {
  'use strict';

  let translatePanel = null;   // right-side panel (Alt+T / popup)
  let inlinePopover = null;    // inline tooltip above selection
  let isVisible = false;
  let selectedText = '';
  let selectionRange = null;   // store Range for inline positioning
  let debounceTimer = null;    // mouseup debounce
  let isDblClick = false;      // prevent mouseup racing with dblclick

  // ─── Extension context guard ──────────────────────────────────────────────

  function isContextValid() {
    try { return !!(chrome.runtime && chrome.runtime.id); } catch (_) { return false; }
  }

  function handleContextInvalidated() {
    hideTranslatePanel();
    hideFloatingIcon();
    hideInlinePopover();
    document.removeEventListener('keydown',   onKeyDown);
    document.removeEventListener('mouseup',   onMouseUp);
    document.removeEventListener('dblclick',  onDblClick);
    document.removeEventListener('mousedown', onDocMouseDown);
  }

  // ─── Inline styles injected once ─────────────────────────────────────────

  function injectStyles() {
    if (document.getElementById('ai-translator-styles')) return;
    const style = document.createElement('style');
    style.id = 'ai-translator-styles';
    style.textContent = `
      /* ── Floating icon ── */
      #ai-translator-float {
        all: initial;
        position: fixed !important;
        width: 30px !important;
        height: 30px !important;
        background: #6366f1 !important;
        border: 1.5px solid #818cf8 !important;
        border-radius: 8px !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        cursor: pointer !important;
        z-index: 2147483646 !important;
        box-shadow: 0 2px 12px rgba(99,102,241,0.45) !important;
        transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease !important;
        animation: ait-popin 0.15s cubic-bezier(0.34,1.56,0.64,1) both !important;
      }
      #ai-translator-float:hover {
        transform: scale(1.12) !important;
        background: #818cf8 !important;
        box-shadow: 0 4px 20px rgba(99,102,241,0.6) !important;
      }
      #ai-translator-float svg {
        width: 16px !important;
        height: 16px !important;
        color: #ffffff !important;
        display: block !important;
      }

      /* ── Inline popover ── */
      #ai-translator-popover {
        all: initial;
        position: fixed !important;
        z-index: 2147483647 !important;
        font-family: 'Outfit', 'Helvetica Neue', sans-serif !important;
        pointer-events: auto !important;
        animation: ait-popover-in 0.2s cubic-bezier(0.16,1,0.3,1) both !important;
      }
      #ai-translator-popover .ait-bubble {
        background: #0f0f11 !important;
        border: 1px solid #27272a !important;
        border-radius: 12px !important;
        box-shadow: 0 8px 32px rgba(0,0,0,0.55), 0 0 0 1px rgba(255,255,255,0.04) !important;
        min-width: 180px !important;
        max-width: 340px !important;
        overflow: hidden !important;
      }
      #ai-translator-popover .ait-bubble-header {
        display: flex !important;
        align-items: center !important;
        justify-content: space-between !important;
        padding: 8px 10px 6px !important;
        border-bottom: 1px solid #1f1f23 !important;
      }
      #ai-translator-popover .ait-badge {
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        font-size: 10px !important;
        font-weight: 600 !important;
        color: #6366f1 !important;
        letter-spacing: 0.06em !important;
        text-transform: uppercase !important;
      }
      #ai-translator-popover .ait-badge svg {
        width: 12px !important;
        height: 12px !important;
        display: block !important;
      }
      #ai-translator-popover .ait-actions {
        display: flex !important;
        align-items: center !important;
        gap: 4px !important;
      }
      #ai-translator-popover .ait-icon-btn {
        all: initial !important;
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 22px !important;
        height: 22px !important;
        border-radius: 6px !important;
        cursor: pointer !important;
        color: #52525b !important;
        transition: background 0.1s, color 0.1s !important;
      }
      #ai-translator-popover .ait-icon-btn:hover {
        background: #27272a !important;
        color: #e4e4e7 !important;
      }
      #ai-translator-popover .ait-icon-btn svg {
        width: 12px !important;
        height: 12px !important;
        display: block !important;
      }
      #ai-translator-popover .ait-body {
        padding: 10px 12px 12px !important;
      }
      #ai-translator-popover .ait-result {
        font-size: 13.5px !important;
        line-height: 1.65 !important;
        color: #e4e4e7 !important;
        word-break: break-word !important;
      }
      #ai-translator-popover .ait-result.loading {
        display: flex !important;
        align-items: center !important;
        gap: 5px !important;
        color: #52525b !important;
        font-size: 12px !important;
      }
      #ai-translator-popover .ait-result.error {
        color: #f87171 !important;
        font-size: 12px !important;
      }
      #ai-translator-popover .ait-dots {
        display: flex !important;
        gap: 3px !important;
      }
      #ai-translator-popover .ait-dots span {
        width: 5px !important;
        height: 5px !important;
        background: #6366f1 !important;
        border-radius: 50% !important;
        animation: ait-bounce 1.2s infinite ease-in-out both !important;
      }
      #ai-translator-popover .ait-dots span:nth-child(2) { animation-delay: 0.16s !important; }
      #ai-translator-popover .ait-dots span:nth-child(3) { animation-delay: 0.32s !important; }
      /* caret arrow */
      #ai-translator-popover .ait-caret {
        position: absolute !important;
        bottom: -6px !important;
        left: 50% !important;
        transform: translateX(-50%) !important;
        width: 12px !important;
        height: 6px !important;
        overflow: visible !important;
      }
      #ai-translator-popover .ait-caret.up {
        bottom: auto !important;
        top: -6px !important;
        transform: translateX(-50%) rotate(180deg) !important;
      }
      #ai-translator-popover .ait-caret path {
        fill: #0f0f11 !important;
        stroke: #27272a !important;
        stroke-width: 1 !important;
        stroke-linejoin: round !important;
      }

      /* ── Existing panel styles ── */
      #ai-translator-panel .panel-header {
        display: flex; justify-content: space-between; align-items: center;
        padding: 14px 16px; border-bottom: 1px solid #2a2a2e;
      }
      #ai-translator-panel .panel-title {
        display: flex; align-items: center; gap: 8px;
        font-size: 14px; font-weight: 600; color: #818cf8;
      }
      #ai-translator-panel .panel-title svg { width: 18px; height: 18px; }
      #ai-translator-panel .panel-close {
        background: transparent; border: none; color: #6e6e73;
        cursor: pointer; padding: 4px; border-radius: 6px; transition: all 0.2s;
      }
      #ai-translator-panel .panel-close:hover { background: #242428; color: #f5f5f7; }
      #ai-translator-panel .panel-close svg { width: 16px; height: 16px; }
      #ai-translator-panel .panel-source,
      #ai-translator-panel .panel-target { padding: 12px 16px; }
      #ai-translator-panel .panel-label {
        font-size: 11px; color: #6e6e73; text-transform: uppercase;
        letter-spacing: 0.05em; margin-bottom: 8px;
      }
      #ai-translator-panel .input-text {
        font-family: 'JetBrains Mono', monospace; font-size: 13px;
        line-height: 1.6; color: #a1a1a6; max-height: 100px; overflow-y: auto;
      }
      #ai-translator-panel .panel-divider { height: 1px; background: #2a2a2e; margin: 0 16px; }
      #ai-translator-panel .output-text {
        font-family: 'JetBrains Mono', monospace; font-size: 13px;
        line-height: 1.6; color: #f5f5f7; max-height: 120px; overflow-y: auto; min-height: 40px;
      }
      #ai-translator-panel .panel-footer {
        display: flex; justify-content: flex-end; padding: 10px 16px; border-top: 1px solid #2a2a2e;
      }
      #ai-translator-panel .copy-btn {
        display: flex; align-items: center; gap: 6px; background: #6366f1; border: none;
        border-radius: 8px; padding: 8px 12px; color: white; font-size: 12px;
        font-weight: 500; cursor: pointer; transition: background 0.2s;
      }
      #ai-translator-panel .copy-btn:hover { background: #818cf8; }
      #ai-translator-panel .copy-btn svg { width: 14px; height: 14px; }
      #ai-translator-panel .loading-dots { display: flex; gap: 4px; }
      #ai-translator-panel .loading-dots span {
        width: 6px; height: 6px; background: #6366f1; border-radius: 50%;
        animation: ait-bounce 1.4s infinite ease-in-out both;
      }
      #ai-translator-panel .loading-dots span:nth-child(1) { animation-delay: -0.32s; }
      #ai-translator-panel .loading-dots span:nth-child(2) { animation-delay: -0.16s; }

      /* ── Keyframes ── */
      @keyframes ait-popin {
        from { opacity: 0; transform: scale(0.7); }
        to   { opacity: 1; transform: scale(1); }
      }
      @keyframes ait-popover-in {
        from { opacity: 0; transform: translateY(6px) scale(0.97); }
        to   { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes ait-bounce {
        0%, 80%, 100% { transform: scale(0); }
        40%           { transform: scale(1); }
      }
    `;
    document.head.appendChild(style);
  }

  // ─── Floating icon (appears near cursor after selection) ──────────────────

  function showFloatingIcon(x, y) {
    injectStyles();
    hideFloatingIcon();

    const icon = document.createElement('div');
    icon.id = 'ai-translator-float';
    icon.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/>
        <path d="M2 5h12"/><path d="M7 2v3"/>
        <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
      </svg>`;
    icon.style.left = (x + 12) + 'px';
    icon.style.top  = (y - 38) + 'px';

    icon.addEventListener('mousedown', (e) => e.preventDefault());
    icon.addEventListener('click', () => {
      if (!isContextValid()) { hideFloatingIcon(); return; }
      hideFloatingIcon();
      showInlinePopover(selectedText, selectionRange);
    });

    document.body.appendChild(icon);
  }

  function hideFloatingIcon() {
    const el = document.getElementById('ai-translator-float');
    if (el) el.remove();
  }

  // ─── Inline popover (appears above selected text) ─────────────────────────

  function showInlinePopover(text, range) {
    injectStyles();
    hideInlinePopover();

    const popover = document.createElement('div');
    popover.id = 'ai-translator-popover';
    inlinePopover = popover;

    const bubble = document.createElement('div');
    bubble.className = 'ait-bubble';
    bubble.innerHTML = `
      <div class="ait-bubble-header">
        <span class="ait-badge">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round">
            <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/>
            <path d="M2 5h12"/><path d="M7 2v3"/>
            <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
          </svg>
          AI 翻译
        </span>
        <div class="ait-actions">
          <button class="ait-icon-btn ait-copy-btn" title="复制">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round">
              <rect x="9" y="9" width="13" height="13" rx="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="ait-body">
        <div class="ait-result loading">
          <div class="ait-dots"><span></span><span></span><span></span></div>
          <span>翻译中...</span>
        </div>
      </div>`;

    // Caret arrow
    const caret = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    caret.setAttribute('viewBox', '0 0 12 6');
    caret.setAttribute('width', '12');
    caret.setAttribute('height', '6');
    caret.classList.add('ait-caret');
    caret.innerHTML = `<path d="M0 0 L6 6 L12 0" />`;
    bubble.appendChild(caret);
    popover.appendChild(bubble);
    document.body.appendChild(popover);

    // Position above the selection
    positionPopover(popover, caret, range);

    // Prevent bubble mousedown from clearing selection (except copy btn which needs to fire)
    bubble.addEventListener('mousedown', (e) => {
      if (!e.target.closest('.ait-copy-btn')) {
        e.preventDefault();
      }
    });

    // Copy button: use async clipboard, fallback to execCommand
    bubble.querySelector('.ait-copy-btn').addEventListener('click', async () => {
      const result = bubble.querySelector('.ait-result');
      const t = result?.textContent?.trim();
      if (!t || result.classList.contains('loading') || result.classList.contains('error')) return;

      const btn = bubble.querySelector('.ait-copy-btn');
      try {
        await navigator.clipboard.writeText(t);
      } catch (_) {
        // Fallback for browsers/pages that block clipboard API
        const ta = document.createElement('textarea');
        ta.value = t;
        ta.style.cssText = 'position:fixed;opacity:0;pointer-events:none';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
      // Visual feedback
      const origColor = btn.style.color;
      btn.style.color = '#4ade80';
      setTimeout(() => { btn.style.color = origColor; }, 1200);
    });

    // Translate
    performInlineTranslation(text, bubble);
  }

  function positionPopover(popover, caret, range) {
    // Temporarily show off-screen to measure
    popover.style.visibility = 'hidden';
    popover.style.left = '0px';
    popover.style.top  = '0px';

    requestAnimationFrame(() => {
      const rect   = range ? range.getBoundingClientRect() : { left: 100, top: 100, right: 200, bottom: 120, width: 100 };
      const pw     = popover.offsetWidth  || 260;
      const ph     = popover.offsetHeight || 80;
      const margin = 10;
      const vw     = window.innerWidth;
      const vh     = window.innerHeight;

      // Horizontal: center on selection, keep inside viewport
      const selCenterX = rect.left + rect.width / 2;
      let left = selCenterX - pw / 2;
      left = Math.max(margin, Math.min(left, vw - pw - margin));

      // Vertical: try above, fall back to below
      const topAbove  = rect.top  - ph - 10;
      const topBelow  = rect.bottom + 10;
      const placeAbove = topAbove >= margin;
      const top = placeAbove ? topAbove : topBelow;

      popover.style.left = left + 'px';
      popover.style.top  = top  + 'px';
      popover.style.visibility = 'visible';

      // Position caret
      const caretX = selCenterX - left;
      const clampedCaretX = Math.max(16, Math.min(caretX, pw - 16));
      caret.style.left = clampedCaretX + 'px';
      caret.style.marginLeft = '0';
      caret.style.transform = 'translateX(-50%)';
      if (!placeAbove) {
        caret.classList.add('up');
      }
    });
  }

  async function performInlineTranslation(text, bubble) {
    const resultEl = bubble.querySelector('.ait-result');

    if (!isContextValid()) {
      resultEl.className = 'ait-result error';
      resultEl.textContent = '扩展已更新，请刷新页面后重试。';
      return;
    }

    const result = await new Promise((resolve) => {
      chrome.runtime.sendMessage(
        { action: 'translate', text, sourceLang: 'auto', targetLang: 'zh' },
        (response) => {
          const lastErr = chrome.runtime.lastError;
          if (lastErr) resolve({ success: false, _runtimeError: lastErr.message });
          else resolve(response);
        }
      );
    });

    if (!result || result._runtimeError) {
      const isInvalidated = !result ||
        result._runtimeError?.includes('Extension context invalidated') ||
        result._runtimeError?.includes('Could not establish connection');
      resultEl.className = 'ait-result error';
      resultEl.textContent = isInvalidated
        ? '扩展已更新，请刷新页面后重试。'
        : `Error: ${result?._runtimeError ?? '未知错误'}`;
      return;
    }

    if (result.success) {
      resultEl.className = 'ait-result';
      resultEl.textContent = result.text;
    } else if (result.quotaExceeded) {
      // ── Quota exceeded: show upgrade prompt ──
      resultEl.className = 'ait-result';
      resultEl.innerHTML = `
        <div style="font-size:12px;color:#fbbf24;margin-bottom:8px;">
          ⚡ 今日免费额度已用完（20次/天）
        </div>
        <a href="${chrome.runtime.getURL('landing.html')}" target="_blank"
          style="display:inline-flex;align-items:center;gap:5px;padding:6px 12px;
                 background:linear-gradient(135deg,#6366f1,#818cf8);color:#fff;
                 border-radius:7px;font-size:12px;font-weight:600;text-decoration:none;
                 transition:opacity .15s;">
          🚀 一次性买断 · $5 →
        </a>
        <div style="margin-top:7px;font-size:11px;color:#52525b;">
          已有 Key？点右上角 ⚙️ 进入设置激活
        </div>`;
    } else {
      resultEl.className = 'ait-result error';
      resultEl.textContent = `Error: ${result.error}`;
    }
  }

  function hideInlinePopover() {
    if (inlinePopover) { inlinePopover.remove(); inlinePopover = null; }
  }

  // ─── Event: dblclick — capture double-click word selection ───────────────

  function onDblClick(e) {
    if (!isContextValid()) { handleContextInvalidated(); return; }
    // ignore clicks inside our own UI
    if (e.target.closest('#ai-translator-float, #ai-translator-popover, #ai-translator-panel')) return;

    isDblClick = true; // tell onMouseUp to stand down
    clearTimeout(debounceTimer);

    setTimeout(() => {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (!text || text.length === 0 || text.length >= 500) return;

      selectedText   = text;
      selectionRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      showFloatingIcon(e.clientX, e.clientY);
    }, 10); // tiny delay so browser finishes selecting the word
  }

  // ─── Event: mouseup — capture manual drag selections ─────────────────────

  function onMouseUp(e) {
    if (!isContextValid()) { handleContextInvalidated(); return; }
    if (e.target.closest('#ai-translator-float, #ai-translator-popover, #ai-translator-panel')) return;

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    clearTimeout(debounceTimer);

    // Delay to let dblclick fire first; if dblclick sets the flag, skip
    debounceTimer = setTimeout(() => {
      if (isDblClick) { isDblClick = false; return; }

      const sel  = window.getSelection();
      const text = sel?.toString().trim();

      if (!text || text.length === 0 || text.length >= 500) {
        // Only hide icon if click was outside our UI
        if (!e.target.closest('#ai-translator-float, #ai-translator-popover, #ai-translator-panel')) {
          hideFloatingIcon();
        }
        return;
      }

      selectedText   = text;
      selectionRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
      showFloatingIcon(mouseX, mouseY);
    }, 250); // 250ms covers the dblclick detection window
  }

  // ─── Event: keydown ───────────────────────────────────────────────────────

  function onKeyDown(e) {
    if (!isContextValid()) { handleContextInvalidated(); return; }
    if (e.altKey && e.key === 't') {
      const sel = window.getSelection();
      const text = sel?.toString().trim();
      if (text) {
        selectedText   = text;
        selectionRange = sel.rangeCount > 0 ? sel.getRangeAt(0).cloneRange() : null;
        showInlinePopover(text, selectionRange);
      }
    }
    if (e.key === 'Escape') {
      hideInlinePopover();
      hideFloatingIcon();
      if (isVisible) hideTranslatePanel();
    }
  }

  // ─── Click-outside: dismiss popover and icon when clicking elsewhere ─────

  function onDocMouseDown(e) {
    // If popover is open and click is outside it, close it
    if (inlinePopover && !inlinePopover.contains(e.target)) {
      hideInlinePopover();
    }
    // If icon is visible and click is outside it, hide it
    const floatEl = document.getElementById('ai-translator-float');
    if (floatEl && !floatEl.contains(e.target)) {
      hideFloatingIcon();
    }
  }

  document.addEventListener('keydown',   onKeyDown);
  document.addEventListener('mouseup',   onMouseUp);
  document.addEventListener('dblclick',  onDblClick);
  document.addEventListener('mousedown', onDocMouseDown);

  // ─── Right-side panel (kept for popup / Alt+T fallback) ──────────────────

  async function showTranslatePanel(text) {
    if (!isContextValid()) { handleContextInvalidated(); return; }
    injectStyles();

    if (translatePanel) {
      translatePanel.querySelector('.input-text').textContent = text;
      translatePanel.style.display = 'flex';
      isVisible = true;
      await performTranslation(text);
      return;
    }

    translatePanel = document.createElement('div');
    translatePanel.id = 'ai-translator-panel';
    translatePanel.innerHTML = `
      <div class="panel-header">
        <div class="panel-title">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 8l6 6"/><path d="M4 14l6-6 2-3"/>
            <path d="M2 5h12"/><path d="M7 2v3"/>
            <path d="M22 22l-5-10-5 10"/><path d="M14 18h6"/>
          </svg>
          <span>AI Translate</span>
        </div>
        <div class="panel-actions">
          <button class="panel-close" title="Close">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div class="panel-source">
        <div class="panel-label">Source</div>
        <div class="input-text">${escapeHtml(text)}</div>
      </div>
      <div class="panel-divider"></div>
      <div class="panel-target">
        <div class="panel-label">Translation</div>
        <div class="output-text">
          <div class="loading-dots"><span></span><span></span><span></span></div>
        </div>
      </div>
      <div class="panel-footer">
        <button class="copy-btn" title="Copy translation">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          <span>Copy</span>
        </button>
      </div>`;

    translatePanel.style.cssText = `
      position: fixed; right: 20px; top: 20px; width: 360px; max-height: 400px;
      background: #141416; border: 1px solid #2a2a2e; border-radius: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.5); z-index: 2147483647;
      display: flex; flex-direction: column;
      font-family: 'Space Grotesk', -apple-system, sans-serif;
      color: #f5f5f7; overflow: hidden;`;

    document.body.appendChild(translatePanel);
    isVisible = true;

    translatePanel.querySelector('.panel-close').addEventListener('click', hideTranslatePanel);
    translatePanel.querySelector('.copy-btn').addEventListener('click', async () => {
      const outputEl = translatePanel.querySelector('.output-text');
      const t = outputEl.textContent?.trim();
      if (t) {
        await navigator.clipboard.writeText(t);
        const btn = translatePanel.querySelector('.copy-btn span');
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1500);
      }
    });

    await performTranslation(text);
  }

  async function performTranslation(text) {
    const outputEl = translatePanel.querySelector('.output-text');
    if (!isContextValid()) {
      outputEl.textContent = '扩展已更新，请刷新页面后重试。';
      outputEl.style.color = '#fbbf24';
      return;
    }
    try {
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage(
          { action: 'translate', text, sourceLang: 'auto', targetLang: 'zh' },
          (response) => {
            const lastErr = chrome.runtime.lastError;
            if (lastErr) resolve({ success: false, _runtimeError: lastErr.message });
            else resolve(response);
          }
        );
      });

      if (!result) {
        outputEl.textContent = '扩展已更新，请刷新页面后重试。';
        outputEl.style.color = '#fbbf24';
        handleContextInvalidated(); return;
      }
      if (result._runtimeError) {
        const inv = result._runtimeError.includes('Extension context invalidated') ||
                    result._runtimeError.includes('Could not establish connection');
        outputEl.textContent = inv ? '扩展已更新，请刷新页面后重试。' : `Error: ${result._runtimeError}`;
        outputEl.style.color = '#fbbf24';
        if (inv) handleContextInvalidated();
        return;
      }
      if (result.success) {
        outputEl.textContent = result.text;
      } else {
        outputEl.textContent = `Error: ${result.error}`;
        outputEl.style.color = '#fbbf24';
      }
    } catch (err) {
      outputEl.textContent = `Error: ${err?.message ?? err}`;
      outputEl.style.color = '#fbbf24';
    }
  }

  function hideTranslatePanel() {
    if (translatePanel) { translatePanel.remove(); translatePanel = null; }
    isVisible = false;
  }

  function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

})();

