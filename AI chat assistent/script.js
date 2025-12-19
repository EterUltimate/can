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
// ========== 全局配置 ==========
let settings = {
  apiKey: '',
  model: '',
  apiBaseUrl: 'https://api.gemai.cc' // 默认API基础地址
};

let totalInputTokens = 0;
let totalOutputTokens = 0;

// ========== 工具函数 ==========
function getFullUrl(endpoint) {
  const base = settings.apiBaseUrl.endsWith('/') ? settings.apiBaseUrl.slice(0, -1) : settings.apiBaseUrl;
  return `${base}${endpoint.startsWith('/') ? endpoint : '/' + endpoint}`;
}

// ========== 主题切换 ==========
document.addEventListener('DOMContentLoaded', () => {
  const themeToggle = document.getElementById('themeToggle');
  const body = document.body;

  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') body.classList.add('dark-theme');

  themeToggle.addEventListener('click', () => {
    body.classList.toggle('dark-theme');
    localStorage.setItem('theme', body.classList.contains('dark-theme') ? 'dark' : 'light');
  });
});

// ========== 时间显示 ==========
function updateTime() {
  const now = new Date();
  const timeString = now.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'long'
  });
  document.getElementById('timeData').textContent = timeString;
}

// ========== 天气功能 ==========
async function fetchWeather(city) {
  const weatherElement = document.getElementById('weatherData');
  const cleanCity = encodeURIComponent(city.trim());
  if (!cleanCity) {
    weatherElement.textContent = '请输入城市名';
    return;
  }
  weatherElement.textContent = '获取天气中...';
  try {
    const url = `https://wttr.in/${cleanCity}?format=j1`;
    const response = await fetch(url, { headers: { 'Accept': 'application/json' } });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const current = data.current_condition[0];
    weatherElement.innerHTML = `${current.weatherDesc[0].value}，${current.temp_C}°C（体感 ${current.FeelsLikeC}°C）<br>💧 湿度: ${current.humidity}%`;
  } catch (error) {
    weatherElement.textContent = `❌ 无法获取 "${city}" 的天气`;
  }
}

// ========== 模型元数据 ==========
const MODEL_METADATA = {
  "gpt-4o": { desc: "OpenAI 最强多模态模型", price: { input: 5, output: 15 } },
  "gpt-4o-mini": { desc: "GPT-4o 轻量版，性价比高", price: { input: 0.15, output: 0.6 } },
  "qwen-max": { desc: "通义千问最强版本", price: { input: 2, output: 6 } },
  "claude-3-5-sonnet": { desc: "Anthropic 智能模型", price: { input: 3, output: 15 } }
};

function updateModelDescription(modelId) {
  const descEl = document.getElementById('modelDesc');
  const meta = MODEL_METADATA[modelId];
  if (meta) {
    descEl.innerHTML = `${meta.desc}<br>💰 价格：输入 $${meta.price.input}/1M tokens，输出 $${meta.price.output}/1M tokens`;
  } else {
    descEl.textContent = modelId ? '该模型无详细说明。' : '请选择模型。';
  }
}

// ========== 获取模型列表（使用动态 Base URL）==========
async function fetchModels(apiKey, baseUrl) {
  const modelSelect = document.getElementById('modelSelect');
  const modelDesc = document.getElementById('modelDesc');
  modelSelect.disabled = true;
  modelSelect.innerHTML = '<option value="">加载中...</option>';
  modelDesc.textContent = '正在请求模型列表...';

  try {
    const url = getFullUrl('/v1/models');
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = data.data || [];

    modelSelect.innerHTML = '<option value="">— 自定义模型 ID —</option>';
    models.sort((a, b) => a.id.localeCompare(b.id)).forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id;
      modelSelect.appendChild(opt);
    });

    modelSelect.disabled = false;
    modelDesc.textContent = '请选择模型。';
    if (settings.model && models.some(m => m.id === settings.model)) {
      modelSelect.value = settings.model;
      updateModelDescription(settings.model);
    }
  } catch (error) {
    modelSelect.innerHTML = '<option value="">加载失败</option>';
    modelDesc.textContent = '❌ 模型加载失败，请检查 API Key 或 Base URL。';
    modelSelect.disabled = false;
  }
}

// ========== 保存 Base URL ==========
function validateAndSaveBaseUrl() {
  const input = document.getElementById('apiBaseUrl');
  let url = input.value.trim();
  const statusEl = document.getElementById('baseUrlStatus');

  if (!url) {
    url = 'https://api.gemai.cc';
    input.value = url;
  }

  try {
    new URL(url); // 验证是否为合法 URL
    if (!url.startsWith('http')) throw new Error('必须以 http/https 开头');
  } catch (e) {
    statusEl.textContent = '⚠️ 请输入有效的 URL（如 https://your-proxy.com）';
    statusEl.style.color = '#d9534f';
    return false;
  }

  settings.apiBaseUrl = url;
  localStorage.setItem('agentSettings', JSON.stringify(settings));
  statusEl.textContent = `✅ 已设置为：${url}`;
  statusEl.style.color = '';
  return true;
}

// ========== 初始化设置 ==========
function loadSettings() {
  const saved = localStorage.getItem('agentSettings');
  if (saved) {
    const parsed = JSON.parse(saved);
    settings = { ...settings, ...parsed };
    document.getElementById('apiKey').value = settings.apiKey || '';
    document.getElementById('apiBaseUrl').value = settings.apiBaseUrl || 'https://api.gemai.cc';

    if (settings.apiBaseUrl) {
      document.getElementById('baseUrlStatus').textContent = `当前使用：${settings.apiBaseUrl}`;
    }
  }
}

function enableChat() {
  document.getElementById('messageInput').disabled = false;
  document.getElementById('sendBtn').disabled = false;
}

// ========== 消息系统（使用动态 Base URL）==========(API请求头)
function addMessage(text, sender, isStreaming = false) {
  let messageDiv;
  if (isStreaming) {
    const lastAi = document.querySelector('.message.ai-message.streaming');
    if (lastAi) {
      lastAi.textContent += text;
      return;
    }
    messageDiv = document.createElement('div');
    messageDiv.className = 'message ai-message streaming';
    messageDiv.textContent = text;
  } else {
    messageDiv = document.createElement('div');
    messageDiv.className = `message ${sender}-message`;
    messageDiv.innerHTML = sender === 'ai' ? text.replace(/\n/g, '<br>') : text;
  }
  document.getElementById('chatMessages').appendChild(messageDiv);
  document.getElementById('chatMessages').scrollTop = document.getElementById('chatMessages').scrollHeight;
}

async function sendMessageToAPI(message) {
  const model = settings.model || 'gpt-4o-mini';
  const url = getFullUrl('/v1/chat/completions');

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${settings.apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: message }],
      stream: true,
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`HTTP ${response.status}: ${errText}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let fullResponse = '';
  let usage = { prompt_tokens: 0, completion_tokens: 0 };

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n').filter(line => line.trim().startsWith('data: '));
      for (const line of lines) {
        const data = line.substring(6).trim();
        if (data === '[DONE]') continue;
        try {
          const json = JSON.parse(data);
          if (json.usage) usage = json.usage;
          const content = json.choices?.[0]?.delta?.content || '';
          if (content) {
            fullResponse += content;
            addMessage(content, 'ai', true);
          }
        } catch (e) { /* ignore */ }
      }
    }
  } finally {
    reader.releaseLock();
  }

  const lastStreaming = document.querySelector('.message.ai-message.streaming');
  if (lastStreaming) lastStreaming.classList.remove('streaming');

  const inTokens = usage.prompt_tokens || 0;
  const outTokens = usage.completion_tokens || Math.ceil(fullResponse.length / 4);
  totalInputTokens += inTokens;
  totalOutputTokens += outTokens;
  updateCostDisplay(model, inTokens, outTokens);
}
//========== 消耗计算 ==========
function updateCostDisplay(model, inTokens, outTokens) {
  const costData = document.getElementById('costData');
  let totalCost = 0;
  if (MODEL_METADATA[model]) {
    const p = MODEL_METADATA[model].price;
    totalCost = (inTokens * p.input + outTokens * p.output) / 1e6;
  }
  const totalEstimated = ((totalInputTokens * (MODEL_METADATA[model]?.price.input || 0) +
                          totalOutputTokens * (MODEL_METADATA[model]?.price.output || 0)) / 1e6);
  costData.innerHTML = `
    输入: ${totalInputTokens} tokens<br>
    输出: ${totalOutputTokens} tokens<br>
    本次: ~$${totalCost.toFixed(5)}<br>
    总计: ~$${totalEstimated.toFixed(5)}
  `;
}

// ========== 事件绑定 ==========
document.addEventListener('DOMContentLoaded', () => {
  // 保存 Base URL
  document.getElementById('saveBaseUrl').addEventListener('click', () => {
    if (validateAndSaveBaseUrl()) {
      addMessage(`🌐 API 基础 URL 已更新为：${settings.apiBaseUrl}`, 'ai');
    }
  });

  // 保存 API Key
  document.getElementById('saveSettings').addEventListener('click', () => {
    const key = document.getElementById('apiKey').value.trim();
    if (!key) return alert('请输入 API 密钥！');
    settings.apiKey = key;
    localStorage.setItem('agentSettings', JSON.stringify(settings));
    fetchModels(key, settings.apiBaseUrl);
    enableChat();
    addMessage('✅ 设置已保存，模型列表已更新！', 'ai');
  });

  // 发送消息
  document.getElementById('sendBtn').addEventListener('click', async () => {
    const input = document.getElementById('messageInput');
    const msg = input.value.trim();
    if (!msg) return;
    addMessage(msg, 'user');
    input.value = '';
    try {
      await sendMessageToAPI(msg);
    } catch (err) {
      addMessage(`❌ 错误：${err.message}`, 'ai');
    }
  });

  // 回车发送
  document.getElementById('messageInput').addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      document.getElementById('sendBtn').click();
    }
  });

  // 模型选择
  document.getElementById('modelSelect').addEventListener('change', (e) => {
    settings.model = e.target.value;
    localStorage.setItem('agentSettings', JSON.stringify(settings));
    updateModelDescription(settings.model);
  });

  // 城市天气
  const cityInput = document.getElementById('cityInput');
  let debounceTimer;
  cityInput.addEventListener('input', (e) => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      const city = e.target.value.trim();
      if (city) {
        fetchWeather(city);
        localStorage.setItem('preferredCity', city);
      }
    }, 500);
  });

  // 初始化
  loadSettings();
  const savedCity = localStorage.getItem('preferredCity') || '温州';
  cityInput.value = savedCity;
  fetchWeather(savedCity);

  updateTime();
  setInterval(updateTime, 1000);
});