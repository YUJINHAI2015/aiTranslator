# 🚀 快速开始指南

## 问题 1：点击买断按钮没有响应

### 调试步骤：

1. **打开浏览器控制台**
   - 在 `landing.html` 页面按 `F12` 或右键 → 检查
   - 切换到 `Console` 标签
   
2. **查看日志输出**
   - 应该看到：`✅ 支付按钮已找到，正在绑定事件...`
   - 点击按钮后应该看到：`🔔 打开支付弹窗`
   
3. **如果没有日志**
   - 检查是否有 JavaScript 错误
   - 确认 `images/wechat-qr.png` 和 `images/alipay-qr.png` 文件存在

### 快速测试：
打开 `test-payment.html` 来验证弹窗功能是否正常

---

## 问题 2：如何发送 License Keys 给用户

### 完整流程：

#### 1️⃣ 用户支付
- 用户扫码支付 $5
- **在付款备注中填写邮箱**（重要！）

#### 2️⃣ 你收到付款通知
- 微信/支付宝会推送付款通知
- 查看付款备注中的用户邮箱

#### 3️⃣ 发送 License Key

**方法 A：手动发送（推荐）**

1. 打开 `LICENSE_KEYS.md`
2. 复制第一个未使用的 Key（例如：`AITX-A7K9-M3R6-P2W8`）
3. 发送邮件给用户：

```
收件人：用户邮箱
主题：AI Translator Pro - License Key

感谢购买 AI Translator Pro！🎉

━━━━━━━━━━━━━━━━━━━━

你的 License Key：
AITX-A7K9-M3R6-P2W8

━━━━━━━━━━━━━━━━━━━━

激活步骤：
1. 在 Chrome 中打开扩展管理页（chrome://extensions/）
2. 找到 AI Translator，点击「选项」或右键 → 设置
3. 在 License 激活区域输入上面的 Key
4. 点击「激活」按钮
5. 刷新正在翻译的网页，即可无限使用！

如有问题请回复此邮件。

祝使用愉快！
```

4. 在 `LICENSE_KEYS.md` 中标记该 Key 为已使用

---

## 问题 3：如何记录已使用的 Keys

### 方法 A：手动管理（简单）

编辑 `LICENSE_KEYS.md` 文件：

```markdown
## 已使用的 Key

| License Key | 用户邮箱 | 激活时间 | 备注 |
|------------|----------|---------|------|
| AITX-A7K9-M3R6-P2W8 | user@example.com | 2025-01-15 | 首位用户 |
| AITX-B4J2-N8Q5-L1T7 | another@example.com | 2025-01-16 | |
```

### 方法 B：使用管理工具（推荐）

我已经创建了 `license-manager.html`，打开它可以：
- ✅ 查看剩余 Key 数量
- ✅ 一键复制未使用的 Key
- ✅ 标记已使用（输入用户邮箱和时间）
- ✅ 搜索和过滤
- ✅ 导出记录

**使用步骤：**
1. 用浏览器打开 `license-manager.html`
2. 点击「复制下一个可用 Key」
3. 发送给用户后，点击「标记为已使用」
4. 输入用户邮箱，自动保存记录

---

## 📋 完整销售流程总结

```
1. 用户点击「立即购买」
   ↓
2. 弹窗显示收款码
   ↓
3. 用户扫码支付 $5（备注邮箱）
   ↓
4. 你收到付款通知
   ↓
5. 打开 license-manager.html
   ↓
6. 点击「复制下一个 Key」
   ↓
7. 发送邮件给用户（模板见上方）
   ↓
8. 在管理工具中标记为已使用
```

---

## 🐛 常见问题排查

### 按钮点击无响应
1. 打开控制台检查错误
2. 确认图片文件存在
3. 尝试打开 `test-payment.html` 测试

### 弹窗不显示
1. 检查 CSS `.payment-modal.active` 样式
2. 确认 `classList.add('active')` 被调用
3. 查看控制台是否有日志输出

### 找不到 License Key
1. 打开 `LICENSE_KEYS.md`
2. 从「未使用的 Key」区域选择
3. 复制完整 Key（格式：AITX-XXXX-XXXX-XXXX）

---

## ⚡ 下一步

1. 生成微信/支付宝收款码（$5，约 ¥36）
2. 重命名为 `wechat-qr.png` 和 `alipay-qr.png`
3. 放入 `images/` 文件夹
4. 打开 `landing.html` 测试购买按钮
5. 打开 `license-manager.html` 准备管理 Keys
