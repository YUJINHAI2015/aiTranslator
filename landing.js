// landing.js - AI Translator 落地页脚本

// ===== 滚动淡入动画 =====
var obs = new IntersectionObserver(function(entries) {
  entries.forEach(function(e) {
    if (e.isIntersecting) {
      e.target.style.opacity = '1';
      e.target.style.animation = 'fadeUp 0.55s ' + (e.target.dataset.delay || 0) + 's both';
      obs.unobserve(e.target);
    }
  });
}, { threshold: 0.1 });

document.querySelectorAll('.feat-card, .step, .pf-item').forEach(function(el, i) {
  el.style.opacity = '0';
  el.dataset.delay = (i % 4) * 0.07;
  obs.observe(el);
});

// ===== 支付弹窗逻辑 =====
(function() {
  function init() {
    var modal         = document.getElementById('paymentModal');
    var showBtn       = document.getElementById('showPaymentBtn');
    var closeBtn      = document.getElementById('closePaymentBtn');
    var stepEmail     = document.getElementById('stepEmail');
    var stepQR        = document.getElementById('stepQR');
    var stepWaiting   = document.getElementById('stepWaiting');
    var stepPaid      = document.getElementById('stepPaid');
    var emailInput    = document.getElementById('emailInput');
    var emailError    = document.getElementById('emailError');
    var nextStepBtn   = document.getElementById('nextStepBtn');
    var emailConfirm  = document.getElementById('emailConfirm');
    var emailReminder = document.getElementById('emailReminder');
    var waitingEmail  = document.getElementById('waitingEmail');
    var waitingMailto = document.getElementById('waitingMailto');
    var tabs          = document.querySelectorAll('.payment-tab');
    var wechatQR      = document.getElementById('wechatQR');
    var alipayQR      = document.getElementById('alipayQR');
    // stepPaid elements
    var paidDoneBtn          = document.getElementById('paidDoneBtn');
    var screenshotInput      = document.getElementById('screenshotInput');
    var dropZone             = document.getElementById('dropZone');
    var dropHint             = document.getElementById('dropHint');
    var previewImg           = document.getElementById('previewImg');
    var previewName          = document.getElementById('previewName');
    var submitScreenshotBtn  = document.getElementById('submitScreenshotBtn');
    var sendStatus           = document.getElementById('sendStatus');
    var paidEmailLabel       = document.getElementById('paidEmailLabel');
    var paidEmailBottom      = document.getElementById('paidEmailBottom');
    var copySellerEmailBtn   = document.getElementById('copySellerEmailBtn');
    var currentScreenshotB64 = null;
    var currentScreenshotMime= null;
    var currentScreenshotName= null;

    // ── 通用复制函数（兼容 HTTP 环境）──────────────────────
    function copyText(text, btn, defaultLabel) {
      var done = function() {
        btn.textContent = '✅ 已复制！';
        btn.style.background = '#10b981';
        setTimeout(function() {
          btn.textContent = defaultLabel;
          btn.style.background = '#6366f1';
        }, 2000);
      };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(text).then(done).catch(function() { fallbackCopy(text, done); });
      } else {
        fallbackCopy(text, done);
      }
    }
    function fallbackCopy(text, cb) {
      var ta = document.createElement('textarea');
      ta.value = text;
      ta.style.cssText = 'position:fixed;opacity:0;top:0;left:0;';
      document.body.appendChild(ta);
      ta.focus(); ta.select();
      try { document.execCommand('copy'); } catch(e) {}
      document.body.removeChild(ta);
      if (cb) cb();
    }

    // 绑定复制商家邮箱按钮
    if (copySellerEmailBtn) {
      copySellerEmailBtn.onclick = function() {
        var email = copySellerEmailBtn.getAttribute('data-email');
        copyText(email, copySellerEmailBtn, '📋 复制商家邮箱');
      };
    }

    if (!showBtn || !modal) return;

    // 统一隐藏所有步骤
    function hideAll() {
      stepEmail.style.display   = 'none';
      stepQR.style.display      = 'none';
      stepWaiting.style.display = 'none';
      stepPaid.style.display    = 'none';
    }

    // 重置截图区域状态
    function resetScreenshot() {
      currentScreenshotB64  = null;
      currentScreenshotMime = null;
      currentScreenshotName = null;
      if (screenshotInput)      screenshotInput.value      = '';
      if (previewImg)         { previewImg.style.display   = 'none'; previewImg.src = ''; }
      if (previewName)          previewName.style.display  = 'none';
      if (dropHint)             dropHint.style.display     = 'block';
      if (dropZone)           { dropZone.style.borderColor = '#c7d2fe'; dropZone.style.background = '#f8f9ff'; }
      if (submitScreenshotBtn){ submitScreenshotBtn.disabled = true;
                                submitScreenshotBtn.style.opacity    = '0.45';
                                submitScreenshotBtn.style.cursor     = 'not-allowed';
                                submitScreenshotBtn.style.background = 'linear-gradient(135deg,#6366f1,#7c3aed)';
                                submitScreenshotBtn.textContent      = '📤 发送截图给卖家'; }
      if (sendStatus)           sendStatus.style.display   = 'none';
    }

    // 打开弹窗，重置到第一步
    showBtn.onclick = function() {
      hideAll();
      stepEmail.style.display      = 'block';
      emailInput.value             = '';
      emailInput.style.borderColor = '#e2e8f0';
      emailError.style.display     = 'none';
      resetScreenshot();
      modal.style.display          = 'flex';
    };

    // 关闭弹窗，同时清空截图
    function closeModal() {
      modal.style.display = 'none';
      resetScreenshot();
    }
    closeBtn.onclick = closeModal;
    modal.onclick = function(e) {
      if (e.target === modal) closeModal();
    };

    // ===== 邮箱验证（正则校验） =====
    function isValidEmail(email) {
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    }

    // 第一步：验证邮箱 → 进入扫码步骤
    function goToQR() {
      var email = emailInput.value.trim();
      if (!isValidEmail(email)) {
        emailInput.style.borderColor = '#ef4444';
        emailError.style.display     = 'block';
        emailInput.focus();
        return;
      }
      // 邮箱合法：清除错误状态
      emailInput.style.borderColor = '#10b981';
      emailError.style.display     = 'none';

      emailConfirm.textContent  = 'License Key 将发送至：' + email;
      emailReminder.textContent = email;

      hideAll();
      stepQR.style.display = 'block';
    }

    nextStepBtn.onclick = goToQR;
    emailInput.onkeydown = function(e) { if (e.key === 'Enter') goToQR(); };
    // 输入时实时清除错误提示
    emailInput.oninput = function() {
      if (isValidEmail(emailInput.value.trim())) {
        emailInput.style.borderColor = '#10b981';
        emailError.style.display     = 'none';
      } else {
        emailInput.style.borderColor = '#e2e8f0';
      }
    };

    // 切换微信 / 支付宝
    tabs.forEach(function(tab) {
      tab.onclick = function() {
        tabs.forEach(function(t) {
          t.style.background  = '#fff';
          t.style.color       = '#1e293b';
          t.style.borderColor = '#e2e8f0';
        });
        tab.style.background  = '#f0f1ff';
        tab.style.color       = '#6366f1';
        tab.style.borderColor = '#6366f1';
        wechatQR.style.display = tab.dataset.tab === 'wechat' ? 'block' : 'none';
        alipayQR.style.display = tab.dataset.tab === 'alipay' ? 'block' : 'none';
      };
    });

    // ===== 进入等待页（公共函数） =====
    function goToWaiting() {
      var email = emailInput.value.trim();
      waitingEmail.textContent = email;
      waitingMailto.href = 'mailto:roomyu0303@gmail.com'
        + '?subject=' + encodeURIComponent('AI Translator 购买截图 - ' + email)
        + '&body=' + encodeURIComponent('你好，\n\n我已完成付款，邮箱为：' + email + '\n\n付款截图见附件，请发送 License Key，谢谢！');
      hideAll();
      stepWaiting.style.display = 'block';
    }

    // ===== Server酱微信通知 =====
    var SCTKEY = 'SCT349248TooWVfEdWL7TKF9xp4iVag1OK';
    function notifyWeChat(title, desp) {
      var url = 'https://sctapi.ftqq.com/' + SCTKEY + '.send';
      var body = 'title=' + encodeURIComponent(title) + '&desp=' + encodeURIComponent(desp);
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body
      }).catch(function() {}); // 静默失败，不影响用户流程
    }

    // ===== 进入已付款 → 提交截图步骤 =====
    function goToPaid() {
      var email = emailInput.value.trim();
      hideAll();
      stepPaid.style.display = 'block';
      // 🔔 第一时间通知：用户点击了"我已付款"
      var now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      notifyWeChat(
        '💰 有新用户声称已付款！',
        '**邮箱：** ' + email + '\n\n' +
        '**时间：** ' + now + '\n\n' +
        '**状态：** 已进入截图提交页，等待用户发截图\n\n' +
        '> 请留意邮件 roomyu0303@gmail.com'
      );
    }

    if (paidDoneBtn) paidDoneBtn.onclick = goToPaid;

    // ─── 截图上传 & 预览 ───────────────────────────────
    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        currentScreenshotB64  = e.target.result;
        currentScreenshotMime = file.type;
        currentScreenshotName = file.name;
        previewImg.src = e.target.result;
        previewImg.style.display   = 'block';
        previewName.textContent    = '📎 ' + file.name;
        previewName.style.display  = 'block';
        dropHint.style.display     = 'none';
        dropZone.style.borderColor = '#10b981';
        dropZone.style.background  = '#f0fdf4';
        if (submitScreenshotBtn) {
          submitScreenshotBtn.disabled          = false;
          submitScreenshotBtn.style.opacity     = '1';
          submitScreenshotBtn.style.cursor      = 'pointer';
          submitScreenshotBtn.textContent       = '📤 发送截图给卖家';
          submitScreenshotBtn.style.background  = 'linear-gradient(135deg,#6366f1,#7c3aed)';
        }
        if (sendStatus) sendStatus.style.display = 'none';
      };
      reader.readAsDataURL(file);
    }

    // ─── 发送前压缩图片（避免超过 Vercel 4.5MB 限制）──────
    function compressImage(b64, mime, callback) {
      if (!b64) { callback(b64, mime); return; }
      var img = new Image();
      img.onload = function() {
        var MAX = 800, w = img.width, h = img.height;
        if (w > MAX || h > MAX) {
          if (w > h) { h = Math.round(h * MAX / w); w = MAX; }
          else       { w = Math.round(w * MAX / h); h = MAX; }
        }
        var canvas = document.createElement('canvas');
        canvas.width = w; canvas.height = h;
        canvas.getContext('2d').drawImage(img, 0, 0, w, h);
        callback(canvas.toDataURL('image/jpeg', 0.6), 'image/jpeg');
      };
      img.onerror = function() { callback(b64, mime); };
      img.src = b64;
    }

    if (dropZone) {
      dropZone.onclick = function() { screenshotInput.click(); };
      dropZone.ondragover = function(e) {
        e.preventDefault();
        dropZone.style.borderColor = '#6366f1';
        dropZone.style.background  = '#f0f1ff';
      };
      dropZone.ondragleave = function() {
        dropZone.style.borderColor = '#c7d2fe';
        dropZone.style.background  = '#f8f9ff';
      };
      dropZone.ondrop = function(e) {
        e.preventDefault();
        dropZone.style.borderColor = '#c7d2fe';
        dropZone.style.background  = '#f8f9ff';
        if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]);
      };
    }
    if (screenshotInput) {
      screenshotInput.onchange = function() {
        if (screenshotInput.files[0]) handleFile(screenshotInput.files[0]);
      };
    }

    // ─── 一键发送截图 → 先压缩再调用 Vercel API ──────────
    if (submitScreenshotBtn) {
      submitScreenshotBtn.onclick = function() {
        if (!currentScreenshotB64) return;
        var email = emailInput.value.trim();
        submitScreenshotBtn.disabled      = true;
        submitScreenshotBtn.style.opacity = '0.6';
        submitScreenshotBtn.textContent   = '⏳ 处理中…';
        if (sendStatus) sendStatus.style.display = 'none';

        compressImage(currentScreenshotB64, currentScreenshotMime, function(b64, mime) {
          submitScreenshotBtn.textContent = '⏳ 发送中…';
          fetch('https://translate-nine-psi.vercel.app/api/send-screenshot', {
            method:  'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:       email,
              imageBase64: b64,
              imageMime:   mime,
              fileName:    currentScreenshotName,
            }),
          })
        .then(function(r) {
          // 先检查 HTTP 状态，再解析 JSON，避免把 Vercel HTML 错误页当 JSON 解析
          if (!r.ok) {
            return r.text().then(function(text) {
              var msg = '服务器错误 (' + r.status + ')';
              try {
                var j = JSON.parse(text);
                // 拼出完整错误：主错误 + Resend 返回的 detail
                var detail = j.detail ? (typeof j.detail === 'object' ? JSON.stringify(j.detail) : j.detail) : '';
                msg = (j.error || j.message || msg) + (detail ? '：' + detail : '');
              } catch(e) { msg = text.slice(0, 200) || msg; }
              throw new Error(msg);
            });
          }
          return r.json();
        })
        .then(function(data) {
          if (data.success) {
            submitScreenshotBtn.textContent      = '✅ 截图已发送！';
            submitScreenshotBtn.style.background = 'linear-gradient(135deg,#10b981,#059669)';
            submitScreenshotBtn.style.opacity    = '1';
            if (sendStatus) {
              sendStatus.style.display    = 'block';
              sendStatus.style.background = '#f0fdf4';
              sendStatus.style.border     = '1px solid #bbf7d0';
              sendStatus.style.color      = '#166534';
              sendStatus.innerHTML        = '🎉 <strong>截图已成功发送给卖家！</strong>'
                + '<div style="margin-top:8px;font-size:12px;color:#475569;line-height:1.8;">'
                + '卖家将在 <strong style="color:#1e293b;">30 分钟内</strong> 通过邮件发送 License Key 给您'
                + '</div>';
            }
          } else {
            throw new Error(data.error || '发送失败');
          }
        })
        .catch(function(err) {
          submitScreenshotBtn.disabled         = false;
          submitScreenshotBtn.style.opacity    = '1';
          submitScreenshotBtn.style.background = 'linear-gradient(135deg,#6366f1,#7c3aed)';
          submitScreenshotBtn.textContent      = '📤 重新发送';
          if (sendStatus) {
            sendStatus.style.display    = 'block';
            sendStatus.style.background = '#fef2f2';
            sendStatus.style.border     = '1px solid #fecaca';
            sendStatus.style.color      = '#991b1b';
            sendStatus.innerHTML        = '❌ 发送失败，请重试<br><small>' + err.message + '</small>';
          }
        });
        }); // end compressImage
      };
    }

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();





