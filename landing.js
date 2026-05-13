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
    var paidDoneBtn    = document.getElementById('paidDoneBtn');
    var screenshotInput= document.getElementById('screenshotInput');
    var dropZone       = document.getElementById('dropZone');
    var dropHint       = document.getElementById('dropHint');
    var previewImg     = document.getElementById('previewImg');
    var previewName    = document.getElementById('previewName');
    var sendEmailBtn   = document.getElementById('sendEmailBtn');
    var copyEmailBtn   = document.getElementById('copyEmailBtn');
    var copyToast      = document.getElementById('copyToast');
    var paidEmailLabel = document.getElementById('paidEmailLabel');
    var paidEmailBottom= document.getElementById('paidEmailBottom');

    if (!showBtn || !modal) return;

    // 统一隐藏所有步骤
    function hideAll() {
      stepEmail.style.display   = 'none';
      stepQR.style.display      = 'none';
      stepWaiting.style.display = 'none';
      stepPaid.style.display    = 'none';
    }

    // 打开弹窗，重置到第一步
    showBtn.onclick = function() {
      hideAll();
      stepEmail.style.display      = 'block';
      emailInput.value             = '';
      emailInput.style.borderColor = '#e2e8f0';
      emailError.style.display     = 'none';
      modal.style.display          = 'flex';
    };

    // 关闭弹窗
    closeBtn.onclick = function() { modal.style.display = 'none'; };
    modal.onclick = function(e) {
      if (e.target === modal) modal.style.display = 'none';
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
      waitingMailto.href = 'mailto:yujinhai2019@163.com'
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
      if (paidEmailLabel)  paidEmailLabel.textContent  = 'License Key 将发送至：' + email;
      if (paidEmailBottom) paidEmailBottom.textContent = email;
      hideAll();
      stepPaid.style.display = 'block';
      // 🔔 第一时间通知：用户点击了"我已付款"
      var now = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
      notifyWeChat(
        '💰 有新用户声称已付款！',
        '**邮箱：** ' + email + '\n\n' +
        '**时间：** ' + now + '\n\n' +
        '**状态：** 已进入截图提交页，等待用户发截图\n\n' +
        '> 请留意邮件 yujinhai2019@163.com'
      );
    }

    if (paidDoneBtn) paidDoneBtn.onclick = goToPaid;

    // ─── 截图上传 & 预览 ───────────────────────────────
    function handleFile(file) {
      if (!file || !file.type.startsWith('image/')) return;
      var reader = new FileReader();
      reader.onload = function(e) {
        previewImg.src = e.target.result;
        previewImg.style.display  = 'block';
        previewName.textContent   = '📎 ' + file.name;
        previewName.style.display = 'block';
        dropHint.style.display    = 'none';
        dropZone.style.borderColor = '#10b981';
        dropZone.style.background  = '#f0fdf4';
        // 🔔 第二次通知：用户已上传截图
        var email2 = emailInput.value.trim();
        var now2   = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        notifyWeChat(
          '📷 用户已上传付款截图！',
          '**邮箱：** ' + email2 + '\n\n' +
          '**文件名：** ' + file.name + '\n\n' +
          '**时间：** ' + now2 + '\n\n' +
          '> 请查收邮件中的截图，确认后发送 License Key'
        );
      };
      reader.readAsDataURL(file);
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

    // ─── 方式1：邮件发送 ────────────────────────────────
    if (sendEmailBtn) {
      sendEmailBtn.onclick = function() {
        var email = emailInput.value.trim();
        var subject = encodeURIComponent('AI Translator 购买截图 - ' + email);
        var body    = encodeURIComponent(
          '你好，\n\n我已完成付款，邮箱为：' + email +
          '\n\n付款截图见附件，请发送 License Key，谢谢！'
        );
        window.location.href = 'mailto:yujinhai2019@163.com?subject=' + subject + '&body=' + body;
        sendEmailBtn.style.background  = '#f0f1ff';
        sendEmailBtn.style.borderColor = '#6366f1';
        sendEmailBtn.innerHTML = '<span style="font-size:22px;">✅</span><span><span style="display:block;">邮件 App 已打开</span><span style="font-size:12px;font-weight:400;color:#6366f1;">记得附上截图再发送</span></span>';
        // 🔔 通知：用户点击了发邮件按钮
        var now3 = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
        notifyWeChat(
          '📧 用户正在发送截图邮件！',
          '**邮箱：** ' + email + '\n\n' +
          '**时间：** ' + now3 + '\n\n' +
          '> 邮件已触发，请留意 yujinhai2019@163.com 收件箱'
        );
      };
    }

    // ─── 方式2：复制邮箱 ────────────────────────────────
    if (copyEmailBtn) {
      copyEmailBtn.onclick = function() {
        var txt = 'yujinhai2019@163.com';
        if (navigator.clipboard) {
          navigator.clipboard.writeText(txt).then(showCopyToast);
        } else {
          var ta = document.createElement('textarea');
          ta.value = txt; document.body.appendChild(ta);
          ta.select(); document.execCommand('copy');
          document.body.removeChild(ta);
          showCopyToast();
        }
      };
    }

    function showCopyToast() {
      copyToast.style.display = 'block';
      copyEmailBtn.style.borderColor = '#10b981';
      copyEmailBtn.style.background  = '#f0fdf4';
      setTimeout(function() { copyToast.style.display = 'none'; }, 3500);
    }

  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

