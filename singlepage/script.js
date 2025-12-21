// ======================
// 存储工具
// ======================
function getStoredSettings() {
  return {
    apiKey: localStorage.getItem('apiKey')?.trim() || '',
    apiBaseUrl: localStorage.getItem('apiBaseUrl')?.trim() || '',
    model: localStorage.getItem('selectedModel')?.trim() || ''
  };
}

function getStoredChatHistory() {
  try { return JSON.parse(localStorage.getItem('chatHistory') || '[]'); } catch { return []; }
}

function saveChatHistory(h) { localStorage.setItem('chatHistory', JSON.stringify(h)); }

function getStoredTokenStats() {
  try { return JSON.parse(localStorage.getItem('tokenStats') || '{}'); } catch { return { promptTokens: 0, completionTokens: 0, totalTokens: 0 }; }
}

function saveTokenStats(s) { localStorage.setItem('tokenStats', JSON.stringify(s)); }

// ======================
// 主题切换
// ======================
function initTheme() {
  const saved = localStorage.getItem('theme');
  const systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const isDark = saved === 'dark' || (saved === null && systemDark);
  if (isDark) document.body.classList.add('dark-theme');
  updateThemeIcon();
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
  updateThemeIcon();
}

function updateThemeIcon() {
  const icon = document.querySelector('#themeToggle i');
  if (document.body.classList.contains('dark-theme')) {
    icon.className = 'fas fa-sun';
  } else {
    icon.className = 'fas fa-moon';
  }
}

// ======================
// 面板切换
// ======================
function switchPanel(panelId) {
  document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => el.classList.remove('active'));
  
  document.getElementById(`panel-${panelId}`).classList.add('active');
  document.querySelector(`[data-panel="${panelId}"]`).classList.add('active');
  
  // 关闭移动端菜单
  document.getElementById('sidebar').classList.remove('active');
}

// ======================
// 设置页逻辑
// ======================
async function loadModels() {
  const sel = document.getElementById('modelSelect');
  const { apiKey, apiBaseUrl } = getStoredSettings();
  if (!apiKey || !apiBaseUrl) {
    sel.innerHTML = '<option>请先保存 API 设置</option>';
    sel.disabled = true;
    return;
  }

  try {
    sel.disabled = true;
    sel.innerHTML = '<option>加载中...</option>';
    const url = new URL('/v1/models', apiBaseUrl).href;
    const res = await fetch(url, { headers: { 'Authorization': `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const models = Array.isArray(data.data) ? data.data : [];

    sel.innerHTML = '';
    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id;
      sel.appendChild(opt);
    });
    sel.disabled = false;

    const saved = localStorage.getItem('selectedModel');
    if (saved && models.some(m => m.id === saved)) {
      sel.value = saved;
    }
  } catch (err) {
    console.error(err);
    sel.innerHTML = '<option>加载失败</option>';
    sel.disabled = true;
  }
}

function initSettingsPage() {
  const s = getStoredSettings();
  document.getElementById('apiKey').value = s.apiKey;
  document.getElementById('apiBaseUrl').value = s.apiBaseUrl;

  document.getElementById('saveSettings').onclick = () => {
    const key = document.getElementById('apiKey').value.trim();
    const url = document.getElementById('apiBaseUrl').value.trim();
    const model = document.getElementById('modelSelect').value.trim();
    if (!key || !url) return alert('请填写完整 API 信息');
    localStorage.setItem('apiKey', key);
    localStorage.setItem('apiBaseUrl', url);
    if (model) localStorage.setItem('selectedModel', model);
    alert('✅ 设置已保存');
  };

  document.getElementById('refreshModels').onclick = loadModels;
  document.getElementById('modelSelect').onchange = (e) => {
    if (e.target.value) localStorage.setItem('selectedModel', e.target.value);
  };

  loadModels();
}

// ======================
// 聊天逻辑
// ======================
function initChatPage() {
  const chatBox = document.getElementById('chatMessages');
  const history = getStoredChatHistory();
  chatBox.innerHTML = '';
  history.forEach(msg => {
    const el = document.createElement('div');
    el.className = `message ${msg.role === 'user' ? 'user-message' : 'ai-message'}`;
    el.textContent = msg.content;
    chatBox.appendChild(el);
  });
  chatBox.scrollTop = chatBox.scrollHeight;
}

async function handleSendMessage() {
  const input = document.getElementById('messageInput');
  const content = input.value.trim();
  if (!content) return;

  const { apiKey, apiBaseUrl, model } = getStoredSettings();
  if (!apiKey || !apiBaseUrl || !model) {
    alert('❌ 请先在“设置”中配置 API 和模型！');
    return;
  }

  let history = getStoredChatHistory();
  history.push({ role: 'user', content });
  saveChatHistory(history);

  const chatBox = document.getElementById('chatMessages');
  const userEl = document.createElement('div');
  userEl.className = 'message user-message';
  userEl.textContent = content;
  chatBox.appendChild(userEl);
  input.value = '';

  const aiEl = document.createElement('div');
  aiEl.className = 'message ai-message streaming';
  aiEl.textContent = '';
  chatBox.appendChild(aiEl);
  chatBox.scrollTop = chatBox.scrollHeight;

  const messages = history.map(m => ({ role: m.role, content: m.content }));
  let fullResponse = '';

  try {
    const url = new URL('/v1/chat/completions', apiBaseUrl).href;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model, messages, stream: true })
    });

    if (!res.ok) throw new Error(`API 错误: ${res.status}`);

    const reader = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      const lines = chunk.split('\n');
      for (const line of lines) {
        if (line.startsWith('data: ') && line !== 'data: [DONE]') {
          try {
            const parsed = JSON.parse(line.slice(6));
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              fullResponse += token;
              aiEl.textContent = fullResponse;
              chatBox.scrollTop = chatBox.scrollHeight;
            }
            if (parsed.usage) {
              const stats = getStoredTokenStats();
              stats.promptTokens += parsed.usage.prompt_tokens || 0;
              stats.completionTokens += parsed.usage.completion_tokens || 0;
              stats.totalTokens += parsed.usage.total_tokens || 0;
              saveTokenStats(stats);
            }
          } catch (e) { /* ignore */ }
        }
      }
    }

    aiEl.classList.remove('streaming');
    history.push({ role: 'assistant', content: fullResponse });
    saveChatHistory(history);
  } catch (err) {
    aiEl.textContent = `❌ 错误: ${err.message}`;
    aiEl.classList.remove('streaming');
  }
}

// ======================
// 用量统计
// ======================
function renderTokenStats() {
  const stats = getStoredTokenStats();
  document.getElementById('thisSession').innerHTML = `
    <div class="metric-card">
      <div class="metric-label">Prompt Tokens</div>
      <div class="metric-value">${stats.promptTokens}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Completion Tokens</div>
      <div class="metric-value">${stats.completionTokens}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Total Tokens</div>
      <div class="metric-value">${stats.totalTokens}</div>
    </div>
  `;
}

// ======================
// 天气
// ======================
async function fetchWeather(city) {
  try {
    const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`);
    return await res.text();
  } catch {
    return '查询失败';
  }
}

// ======================
// 初始化
// ======================
document.addEventListener('DOMContentLoaded', () => {
  initTheme();

  // 事件绑定
  document.getElementById('themeToggle').onclick = toggleTheme;
  document.getElementById('menuToggle').onclick = () => {
    document.getElementById('sidebar').classList.add('active');
  };
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(item => {
    item.onclick = () => switchPanel(item.dataset.panel);
  });

  // 聊天
  document.getElementById('sendBtn').onclick = handleSendMessage;
  document.getElementById('messageInput').onkeydown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  document.getElementById('clearChat').onclick = () => {
    if (confirm('清空所有聊天记录？')) {
      localStorage.removeItem('chatHistory');
      document.getElementById('chatMessages').innerHTML = '';
    }
  };

  // 用量
  document.getElementById('resetStats').onclick = () => {
    if (confirm('重置用量统计？')) {
      saveTokenStats({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
      renderTokenStats();
    }
  };

  // 天气
  document.getElementById('cityInput').onkeypress = async (e) => {
    if (e.key === 'Enter') {
      const city = e.target.value.trim();
      if (!city) return;
      const display = document.getElementById('weatherDisplay');
      display.textContent = '查询中...';
      display.textContent = await fetchWeather(city);
    }
  };

  // 首次渲染
  initSettingsPage();
  initChatPage();
  renderTokenStats();

  // 自动聚焦聊天输入框（仅桌面）
  if (window.innerWidth > 768) {
    document.getElementById('messageInput').focus();
  }
});