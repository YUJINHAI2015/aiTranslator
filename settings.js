document.addEventListener('DOMContentLoaded', () => {
  const apiProvider  = document.getElementById('apiProvider');
  const apiKey       = document.getElementById('apiKey');
  const baseUrl      = document.getElementById('baseUrl');
  const model        = document.getElementById('model');
  const defaultSource = document.getElementById('defaultSource');
  const defaultTarget = document.getElementById('defaultTarget');
  const toggleKey    = document.getElementById('toggleKey');
  const saveBtn      = document.getElementById('saveBtn');
  const resetBtn     = document.getElementById('resetBtn');
  const apiFields    = document.getElementById('apiFields');
  const freeHint     = document.getElementById('freeHint');

  // License elements
  const licenseKeyInput     = document.getElementById('licenseKeyInput');
  const activateBtn         = document.getElementById('activateBtn');
  const deactivateBtn       = document.getElementById('deactivateBtn');
  const licenseStateFree    = document.getElementById('licenseStateFree');
  const licenseStateActiv   = document.getElementById('licenseStateActivated');
  const usedCount           = document.getElementById('usedCount');
  const activatedKeyDisplay = document.getElementById('activatedKeyDisplay');

  const PROVIDER_CONFIG = {
    free: { baseUrl: '', model: '' },
    openai: {
      baseUrl: 'https://api.openai.com/v1/chat/completions',
      model: 'gpt-3.5-turbo'
    },
    anthropic: {
      baseUrl: 'https://api.anthropic.com/v1/messages',
      model: 'claude-3-sonnet-20240229'
    },
    deepseek: {
      baseUrl: 'https://api.deepseek.com/v1/chat/completions',
      model: 'deepseek-chat'
    },
    custom: { baseUrl: '', model: '' }
  };

  loadSettings();
  loadLicenseStatus();

  // ── License event handlers ────────────────────────────────────────────

  activateBtn.addEventListener('click', handleActivate);
  licenseKeyInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleActivate();
  });
  deactivateBtn.addEventListener('click', async () => {
    if (!confirm('确定移除 License Key 并降回免费版？')) return;
    await chrome.storage.local.remove('license');
    loadLicenseStatus();
    showToast('已移除 License Key', 'success');
  });

  async function loadLicenseStatus() {
    try {
      const [licenseResp, usageResp] = await Promise.all([
        chrome.runtime.sendMessage({ action: 'getLicenseStatus' }),
        chrome.runtime.sendMessage({ action: 'getUsage' })
      ]);
      if (licenseResp?.activated) {
        licenseStateFree.classList.add('hidden');
        licenseStateActiv.classList.remove('hidden');
        const short = licenseResp.key.slice(0, 14) + '…';
        activatedKeyDisplay.textContent = `KEY: ${short}`;
      } else {
        licenseStateFree.classList.remove('hidden');
        licenseStateActiv.classList.add('hidden');
        usedCount.textContent = usageResp?.todayCount ?? 0;
      }
    } catch (err) {
      console.error('loadLicenseStatus error:', err);
    }
  }

  async function handleActivate() {
    const key = licenseKeyInput.value.trim();
    if (!key) { showToast('请输入 License Key', 'warning'); return; }
    activateBtn.disabled = true;
    activateBtn.textContent = '验证中…';
    try {
      const result = await chrome.runtime.sendMessage({ action: 'activateLicense', licenseKey: key });
      if (result?.success) {
        showToast(result.message || '激活成功 🎉', 'success');
        licenseKeyInput.value = '';
        loadLicenseStatus();
      } else {
        showToast(result?.message || '激活失败，请检查 Key', 'error');
      }
    } catch (err) {
      showToast(`激活出错: ${err.message}`, 'error');
    } finally {
      activateBtn.disabled = false;
      activateBtn.textContent = '激活';
    }
  }

  function updateProviderUI(isInitialLoad = false) {
    const provider = apiProvider.value;
    const isFree = provider === 'free';
    apiFields.classList.toggle('hidden', isFree);
    freeHint.classList.toggle('hidden', !isFree);

    const config = PROVIDER_CONFIG[provider];
    if (config && provider !== 'custom' && provider !== 'free') {
      baseUrl.value = config.baseUrl;
      model.value   = config.model;
      // Clear API key when switching provider (unless restoring saved settings)
      if (!isInitialLoad) {
        apiKey.value = '';
      }
    }
  }

  apiProvider.addEventListener('change', updateProviderUI);

  toggleKey.addEventListener('click', () => {
    apiKey.type = apiKey.type === 'password' ? 'text' : 'password';
  });

  saveBtn.addEventListener('click', handleSave);
  resetBtn.addEventListener('click', handleReset);

  async function loadSettings() {
    try {
      const result   = await chrome.storage.local.get(['settings']);
      const settings = result.settings || { apiProvider: 'free' };

      apiProvider.value = settings.apiProvider || 'free';
      if (settings.apiKey)        apiKey.value        = settings.apiKey;
      if (settings.baseUrl)       baseUrl.value       = settings.baseUrl;
      if (settings.model)         model.value         = settings.model;
      if (settings.defaultSource) defaultSource.value = settings.defaultSource;
      if (settings.defaultTarget) defaultTarget.value = settings.defaultTarget;

      updateProviderUI(true);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }

  async function handleSave() {
    const isFree = apiProvider.value === 'free';

    if (!isFree && !apiKey.value.trim()) {
      showToast('请输入 API Key', 'warning');
      return;
    }

    const settings = {
      apiProvider:   apiProvider.value,
      apiKey:        isFree ? '' : apiKey.value.trim(),
      baseUrl:       isFree ? '' : baseUrl.value.trim(),
      model:         isFree ? '' : model.value.trim(),
      defaultSource: defaultSource.value,
      defaultTarget: defaultTarget.value
    };

    try {
      await chrome.runtime.sendMessage({ action: 'saveSettings', settings });
      showToast('设置已保存！', 'success');
    } catch (error) {
      showToast(`保存失败: ${error.message}`, 'error');
    }
  }

  async function handleReset() {
    const defaults = {
      apiProvider: 'free', apiKey: '', baseUrl: '', model: '',
      defaultSource: 'auto', defaultTarget: 'zh'
    };
    apiProvider.value   = defaults.apiProvider;
    apiKey.value        = '';
    baseUrl.value       = '';
    model.value         = '';
    defaultSource.value = defaults.defaultSource;
    defaultTarget.value = defaults.defaultTarget;
    updateProviderUI();
    await chrome.runtime.sendMessage({ action: 'saveSettings', settings: defaults });
    showToast('已恢复默认设置', 'success');
  }

  function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    if (type === 'warning') {
      toast.style.borderColor = 'var(--warning)';
      toast.style.color = 'var(--warning)';
    } else if (type === 'error') {
      toast.style.borderColor = '#ef4444';
      toast.style.color = '#ef4444';
    }
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
  }
});
