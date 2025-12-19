/*# AI 助手 - 天气查询与对话系统

本项目是一个支持自定义 API 地址、多模型选择、流式响应与 Token 费用统计的 Web 聊天界面，作为课程作业开发完成。

---

## 📜 开源许可

本项目代码采用 **MIT License** 开源（详见 [`LICENSE`](LICENSE) 文件）。  
你可以自由地：

- ✅ 阅读、学习、参考实现思路；
- ✅ 在个人项目或非学术场景中使用；
- ✅ 修改并用于开源贡献（需保留原作者版权声明）。

---

## 🚫 学术诚信特别声明

> ⚠️ **本项目为原创课程作业，严禁任何形式的学术不端行为！**

**明确禁止以下用途**：
- 将本项目的全部或部分代码直接提交为自己的课程作业、实验报告或毕业设计；
- 仅修改变量名、注释或少量逻辑后声称是自己独立完成的作品；
- 在未明确引用、未获得授权的情况下，将本项目用于任何需要“原创性”评估的学术场景。

**允许的合理使用**：
- 作为技术参考，理解前端交互、API 集成、流式响应等实现方式；
- 在非学术项目（如个人博客、开源工具）中复用部分代码（遵守 MIT 要求）；
- 引用本项目时，请注明原始作者与项目链接。

> 📌 **重要提醒**：  
> 开源 ≠ 放弃著作权 ≠ 允许抄袭。  
> 根据《高等学校科学技术学术规范指南》及多数高校规定，**未经声明直接使用他人开源代码作为个人作业成果，属于学术不端行为**。

---

## 🙏 致谢与交流

欢迎提出 Issue 或 PR 进行技术讨论！  
但请勿请求“帮我改成另一个作业”或“去掉作者信息”——这违背本项目开源初衷。

作者：[EterUltimate]  
邮箱：1831303476@qq.com
学校：[zjnu]
*/
// ========== 全局状态 ==========
let settings = {
  apiKey: '',
  model: '',
  apiBaseUrl: 'https://api.gemai.cc'
};

let totalInputTokens = 0;
let totalOutputTokens = 0;

// ========== 工具函数 ==========
function getFullUrl(endpoint) {
  const base = settings.apiBaseUrl.replace(/\/+$/, '');
  return `${base}${endpoint.startsWith('/') ? '' : '/'}${endpoint}`;
}

function loadSettings() {
  const saved = localStorage.getItem('agentSettings');
  if (saved) {
    const parsed = JSON.parse(saved);
    settings = { ...settings, ...parsed };
  }
  // 加载 Token 统计
  const tokens = JSON.parse(localStorage.getItem('tokenStats') || '{}');
  totalInputTokens = tokens.in || 0;
  totalOutputTokens = tokens.out || 0;
}

function saveSettings() {
  localStorage.setItem('agentSettings', JSON.stringify(settings));
}

function saveTokenStats() {
  localStorage.setItem('tokenStats', JSON.stringify({
    in: totalInputTokens,
    out: totalOutputTokens
  }));
}

// ========== 页面路由分发 ==========
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  // 设置导航高亮
  const currentPage = window.location.pathname.split('/').pop().replace('.html', '') || 'chat';
  document.querySelectorAll('.top-nav a').forEach(link => {
    if (link.getAttribute('href').includes(currentPage)) {
      link.classList.add('active');
    }
  });

  // 主题初始化
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') document.body.classList.add('dark-theme');

  // 根据页面路径执行不同逻辑
  if (currentPage === 'chat') initChatPage();
  if (currentPage === 'weather') initWeatherPage();
  if (currentPage === 'settings') initSettingsPage();
  if (currentPage === 'analytics') initAnalyticsPage();
});

// ========== 各页面初始化函数 ==========
function initChatPage() {
  const sendBtn = document.getElementById('sendBtn');
  const input = document.getElementById('messageInput');
  
  // 模拟加载历史（可扩展）
  addMessage("你好！我是 AI 助手，有什么可以帮您？", 'ai');
  
  sendBtn?.addEventListener('click', async () => {
    const msg = input.value.trim();
    if (!msg) return;
    addMessage(msg, 'user');
    input.value = '';
    
    // 模拟流式响应（实际应调用 API）
    setTimeout(() => {
      addMessage("这是模拟回复。在完整版中，这里会调用你配置的 API。", 'ai');
    }, 500);
  });
}

function initWeatherPage() {
  const cityInput = document.getElementById('cityInput');
  const weatherDisplay = document.getElementById('weatherDisplay');
  
  cityInput.value = localStorage.getItem('lastCity') || '温州';
  fetchWeather(cityInput.value);
  
  let debounce;
  cityInput?.addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const city = e.target.value.trim();
      if (city) {
        localStorage.setItem('lastCity', city);
        fetchWeather(city);
      }
    }, 500);
  });
}

async function fetchWeather(city) {
  const el = document.getElementById('weatherDisplay');
  el.innerHTML = '<p>获取天气中...</p>';
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=j1`);
    const data = await res.json();
    const current = data.current_condition[0];
    el.innerHTML = `
      <div class="weather-icon">🌦</div>
      <h2>${city}</h2>
      <p>${current.weatherDesc[0].value}</p>
      <p style="font-size: 24px; margin: 10px 0;">${current.temp_C}°C</p>
      <p>体感 ${current.FeelsLikeC}°C | 湿度 ${current.humidity}%</p>
    `;
  } catch (e) {
    el.innerHTML = `<p>❌ 无法获取 "${city}" 的天气</p>`;
  }
}

function initSettingsPage() {
  // 填充已保存设置
  document.getElementById('apiKey').value = settings.apiKey;
  document.getElementById('apiBaseUrl').value = settings.apiBaseUrl;
  
  // 保存按钮
  document.getElementById('saveSettings')?.addEventListener('click', () => {
    settings.apiKey = document.getElementById('apiKey').value.trim();
    settings.apiBaseUrl = document.getElementById('apiBaseUrl').value.trim() || 'https://api.gemai.cc';
    
    // 简单 URL 校验
    try {
      new URL(settings.apiBaseUrl);
    } catch (e) {
      alert('请输入有效的 API 基础 URL！');
      return;
    }
    
    saveSettings();
    alert('✅ 设置已保存！');
  });
  
  // 切换主题
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('dark-theme');
    localStorage.setItem('theme', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
  });
}

function initAnalyticsPage() {
  const MODEL_METADATA = {
    "gpt-4o": { price: { input: 5, output: 15 } },
    "gpt-4o-mini": { price: { input: 0.15, output: 0.6 } },
    "qwen-max": { price: { input: 2, output: 6 } }
  };
  
  const model = settings.model || 'gpt-4o-mini';
  const meta = MODEL_METADATA[model] || { price: { input: 0.15, output: 0.6 } };
  
  const inCost = (totalInputTokens * meta.price.input) / 1e6;
  const outCost = (totalOutputTokens * meta.price.output) / 1e6;
  
  document.getElementById('thisSession').innerHTML = `
    <div class="metric-card">
      <span class="metric-label">输入 Tokens</span>
      <span class="metric-value">${totalInputTokens.toLocaleString()}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">输出 Tokens</span>
      <span class="metric-value">${totalOutputTokens.toLocaleString()}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">本次费用</span>
      <span class="metric-value">~$${(inCost + outCost).toFixed(5)}</span>
    </div>
  `;
  
  // 重置按钮（仅演示）
  document.getElementById('resetStats')?.addEventListener('click', () => {
    if (confirm('重置所有统计？')) {
      totalInputTokens = 0;
      totalOutputTokens = 0;
      saveTokenStats();
      location.reload();
    }
  });
}

// ========== 通用函数 ==========
function addMessage(text, sender) {
  const messages = document.querySelector('.chat-messages');
  if (!messages) return;
  
  const div = document.createElement('div');
  div.className = `message ${sender}-message`;
  div.textContent = text;
  messages.appendChild(div);
  messages.scrollTop = messages.scrollHeight;
}