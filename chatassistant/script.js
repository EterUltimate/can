// ======================
// 工具函数
// ======================

function getStoredSettings() {
  return {
    apiKey: localStorage.getItem('apiKey')?.trim() || '',
    apiBaseUrl: localStorage.getItem('apiBaseUrl')?.trim() || '',
    model: localStorage.getItem('selectedModel')?.trim() || ''
  };
}

function getStoredChatHistory() {
  try {
    return JSON.parse(localStorage.getItem('chatHistory') || '[]');
  } catch {
    return [];
  }
}

function saveChatHistory(history) {
  localStorage.setItem('chatHistory', JSON.stringify(history));
}

function getStoredTokenStats() {
  try {
    return JSON.parse(localStorage.getItem('tokenStats') || '{}');
  } catch {
    return { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
  }
}

function saveTokenStats(stats) {
  localStorage.setItem('tokenStats', JSON.stringify(stats));
}

// ======================
// 通用初始化
// ======================

function updateNavActive() {
  const pages = ['chat', 'weather', 'analytics', 'settings'];
  const currentFile = window.location.pathname.split('/').pop().replace('.html', '');
  pages.forEach(page => {
    const link = document.querySelector(`.top-nav a[href="${page}.html"]`);
    if (link) {
      link.classList.toggle('active', page === currentFile);
    }
  });
}

function toggleTheme() {
  const isDark = document.body.classList.toggle('dark-theme');
  localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function initCommon() {
  if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-theme');
  }
  updateNavActive();
  const themeToggleBtn = document.getElementById('themeToggle');
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener('click', toggleTheme);
  }
}

// ======================
// 设置页
// ======================

function initSettingsPage() {
  const settings = getStoredSettings();
  const apiKeyInput = document.getElementById('apiKey');
  const apiBaseUrlInput = document.getElementById('apiBaseUrl');
  const modelSelect = document.getElementById('modelSelect');

  if (apiKeyInput) apiKeyInput.value = settings.apiKey;
  if (apiBaseUrlInput) apiBaseUrlInput.value = settings.apiBaseUrl;

  // 保存设置（含模型）
  const saveBtn = document.getElementById('saveSettings');
  if (saveBtn) {
    saveBtn.addEventListener('click', () => {
      const key = document.getElementById('apiKey')?.value.trim();
      const url = document.getElementById('apiBaseUrl')?.value.trim();
      const model = document.getElementById('modelSelect')?.value.trim();

      if (!key || !url) {
        alert('请填写完整的 API 密钥和基础 URL');
        return;
      }

      localStorage.setItem('apiKey', key);
      localStorage.setItem('apiBaseUrl', url);
      if (model) {
        localStorage.setItem('selectedModel', model); // 👈 关键：保存模型
      }

      alert('✅ 设置已保存');
    });
  }

  // 刷新模型列表
  const refreshBtn = document.getElementById('refreshModels');
  if (refreshBtn) {
    refreshBtn.addEventListener('click', loadModels);
  }

  // 模型下拉框：选择即保存（双重保险）
  if (modelSelect) {
    modelSelect.onchange = function () {
      const model = this.value;
      if (model) {
        localStorage.setItem('selectedModel', model);
      }
    };
  }

  // 初始加载模型
  loadModels();
}

async function loadModels() {
  const modelSelect = document.getElementById('modelSelect');
  if (!modelSelect) return;

  const { apiKey, apiBaseUrl } = getStoredSettings();
  if (!apiKey || !apiBaseUrl) {
    modelSelect.innerHTML = '<option value="">请先保存 API 设置</option>';
    modelSelect.disabled = true;
    return;
  }

  try {
    modelSelect.disabled = true;
    modelSelect.innerHTML = '<option value="">加载中...</option>';

    const url = new URL('/v1/models', apiBaseUrl).href;
    const res = await fetch(url, {
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    const data = await res.json();
    const models = Array.isArray(data.data) ? data.data : [];

    modelSelect.innerHTML = '';
    if (models.length === 0) {
      modelSelect.innerHTML = '<option value="">无可用模型</option>';
      modelSelect.disabled = true;
      return;
    }

    models.forEach(m => {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.id;
      modelSelect.appendChild(opt);
    });

    modelSelect.disabled = false;

    // 恢复已保存的模型
    const savedModel = localStorage.getItem('selectedModel');
    if (savedModel && models.some(m => m.id === savedModel)) {
      modelSelect.value = savedModel;
    }
  } catch (err) {
    console.error('模型加载失败:', err);
    modelSelect.innerHTML = '<option value="">加载失败</option>';
    modelSelect.disabled = true;
    alert('❌ 模型加载失败：' + (err.message || '请检查 API 配置'));
  }
}

// ======================
// 聊天页
// ======================

function initChatPage() {
  const chatMessages = document.getElementById('chatMessages');
  if (!chatMessages) return;

  // 加载历史
  const history = getStoredChatHistory();
  history.forEach(msg => {
    const el = document.createElement('div');
    el.classList.add('message', msg.role === 'user' ? 'user-message' : 'ai-message');
    el.textContent = msg.content;
    chatMessages.appendChild(el);
  });

  // 发送
  const messageInput = document.getElementById('messageInput');
  const sendBtn = document.getElementById('sendBtn');
  const clearBtn = document.getElementById('clearChat');

  if (sendBtn) sendBtn.addEventListener('click', handleSendMessage);
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSendMessage();
      }
    });
  }
  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      if (confirm('清空所有聊天记录？')) {
        localStorage.removeItem('chatHistory');
        chatMessages.innerHTML = '';
      }
    });
  }
}

async function handleSendMessage() {
  const messageInput = document.getElementById('messageInput');
  const chatMessages = document.getElementById('chatMessages');
  if (!messageInput || !chatMessages) return;

  const content = messageInput.value.trim();
  if (!content) return;

  // 实时读取配置
  const { apiKey, apiBaseUrl, model } = getStoredSettings();
  if (!apiKey || !apiBaseUrl || !model) {
    const aiEl = document.createElement('div');
    aiEl.classList.add('message', 'ai-message');
    aiEl.textContent = '❌ 请先在“设置”中完成 API 密钥、URL 和模型选择';
    chatMessages.appendChild(aiEl);
    return;
  }

  // 添加用户消息
  let history = getStoredChatHistory();
  history.push({ role: 'user', content });
  saveChatHistory(history);

  const userEl = document.createElement('div');
  userEl.classList.add('message', 'user-message');
  userEl.textContent = content;
  chatMessages.appendChild(userEl);
  messageInput.value = '';

  // AI 响应
  const aiEl = document.createElement('div');
  aiEl.classList.add('message', 'ai-message', 'streaming');
  aiEl.textContent = '';
  chatMessages.appendChild(aiEl);

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

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`API 错误: ${res.status} - ${text}`);
    }

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
              aiEl.scrollIntoView({ behavior: 'smooth' });
            }
            if (parsed.usage) {
              const stats = getStoredTokenStats();
              stats.promptTokens += parsed.usage.prompt_tokens || 0;
              stats.completionTokens += parsed.usage.completion_tokens || 0;
              stats.totalTokens += parsed.usage.total_tokens || 0;
              saveTokenStats(stats);
            }
          } catch (e) {
            console.warn('解析失败:', line);
          }
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
// 用量统计页
// ======================

function initAnalyticsPage() {
  renderTokenStats();
  const resetBtn = document.getElementById('resetStats');
  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (confirm('重置用量统计？')) {
        saveTokenStats({ promptTokens: 0, completionTokens: 0, totalTokens: 0 });
        renderTokenStats();
      }
    });
  }
}

function renderTokenStats() {
  const container = document.getElementById('thisSession');
  if (!container) return;
  const stats = getStoredTokenStats();
  container.innerHTML = `
    <div class="metric-card">
      <span class="metric-label">Prompt Tokens</span>
      <span class="metric-value">${stats.promptTokens}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Completion Tokens</span>
      <span class="metric-value">${stats.completionTokens}</span>
    </div>
    <div class="metric-card">
      <span class="metric-label">Total Tokens</span>
      <span class="metric-value">${stats.totalTokens}</span>
    </div>
  `;
}

// ======================
// 天气页
// ======================

function initWeatherPage() {
  const cityInput = document.getElementById('cityInput');
  const weatherDisplay = document.getElementById('weatherDisplay');
  if (!cityInput || !weatherDisplay) return;

  cityInput.addEventListener('keypress', async (e) => {
    if (e.key === 'Enter') {
      const city = cityInput.value.trim();
      if (!city) return;
      weatherDisplay.innerHTML = '<p>查询中...</p>';
      try {
        const res = await fetch(`https://wttr.in/${encodeURIComponent(city)}?format=3`);
        const text = await res.text();
        weatherDisplay.innerHTML = `<p>${text || '未找到城市'}</p>`;
      } catch (err) {
        weatherDisplay.innerHTML = `<p>查询失败：${err.message}</p>`;
      }
    }
  });
}

// ======================
// 启动
// ======================

document.addEventListener('DOMContentLoaded', () => {
  initCommon();

  if (window.location.pathname.includes('settings.html')) {
    initSettingsPage();
  } else if (window.location.pathname.includes('chat.html')) {
    initChatPage();
  } else if (window.location.pathname.includes('analytics.html')) {
    initAnalyticsPage();
  } else if (window.location.pathname.includes('weather.html')) {
    initWeatherPage();
  }
});