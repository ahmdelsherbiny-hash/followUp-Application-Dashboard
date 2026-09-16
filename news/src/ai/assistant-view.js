function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' ? url.href : null;
  } catch {
    return null;
  }
}

function button(label, action, className = 'ai-icon-button', documentRef = document) {
  const element = documentRef.createElement('button');
  element.type = 'button';
  element.className = className;
  element.dataset.aiAction = action;
  element.setAttribute('aria-label', label);
  element.title = label;
  return element;
}

export function createAssistantView(callbacks = {}, documentRef = document) {
  const root = documentRef.createElement('div');
  root.id = 'aiAssistantRoot';
  root.className = 'ai-assistant-root';
  root.innerHTML = `
    <div class="ai-backdrop" data-ai-action="close" aria-hidden="true"></div>
    <button type="button" class="ai-fab" data-ai-action="open-last" aria-label="Open AI news assistant" title="Open AI news assistant">
      <span class="ai-fab-spark" aria-hidden="true">✦</span>
      <span>AI</span>
    </button>
    <aside class="ai-panel" role="dialog" aria-modal="true" aria-labelledby="aiPanelTitle" aria-hidden="true">
      <header class="ai-panel-header">
        <div class="ai-panel-brand">
          <span class="ai-brand-mark" aria-hidden="true">✦</span>
          <div>
            <h2 id="aiPanelTitle">News Intelligence</h2>
            <p>Groq-powered assistant</p>
          </div>
        </div>
        <button type="button" class="ai-icon-button" data-ai-action="close" aria-label="Close AI assistant" title="Close">×</button>
      </header>

      <div class="ai-panel-body">
        <section class="ai-empty-state" data-ai-view="empty">
          <span class="ai-empty-icon" aria-hidden="true">✦</span>
          <h3>Select a news article</h3>
          <p>Use the AI icon beside any headline to start an article-focused Arabic explanation.</p>
        </section>

        <section class="ai-key-setup" data-ai-view="setup" hidden>
          <div>
            <span class="ai-kicker">First-time setup</span>
            <h3>Connect your AI key</h3>
            <p>The key stays in this device's IndexedDB and is sent directly to Groq. Browser storage is not a hardware secret vault.</p>
          </div>
          <form data-ai-form="key" class="ai-key-form">
            <div class="ai-field-group">
              <label for="aiApiKey">Groq API key</label>
              <div class="ai-key-row">
                <input id="aiApiKey" name="apiKey" type="password" autocomplete="off" spellcheck="false" placeholder="Paste your gsk_... key" required>
                <button type="submit" class="ai-primary-button" data-ai-busy-sensitive>Test & save</button>
              </div>
            </div>
            <p class="ai-field-help">Free API keys with generous limits are available at console.groq.com.</p>
            <p class="ai-error-text" data-ai-key-error role="alert"></p>
          </form>
          <a class="ai-external-link" href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">Create or manage a key in Groq Console ↗</a>
        </section>

        <section class="ai-workspace" data-ai-view="workspace" hidden>
          <div class="ai-article-context">
            <div>
              <span class="ai-kicker">Selected article</span>
              <h3 data-ai-article-title></h3>
              <p><span data-ai-article-source></span><span aria-hidden="true"> · </span><span data-ai-article-time></span></p>
            </div>
            <a data-ai-article-link target="_blank" rel="noopener noreferrer" aria-label="Open selected article" title="Open source">↗</a>
          </div>

          <div class="ai-toolbar">
            <button type="button" data-ai-action="refresh" class="ai-secondary-button" data-ai-busy-sensitive>Refresh from web</button>
            <button type="button" data-ai-action="clear-article" class="ai-text-button">Clear article AI</button>
          </div>

          <p class="ai-status" data-ai-status role="status" aria-live="polite"></p>

          <div class="ai-conversation-scroll">
            <section class="ai-analysis-card">
              <div class="ai-section-heading">
                <div>
                  <span class="ai-kicker">Article brief</span>
                  <span class="ai-updated-at" data-ai-updated-at></span>
                </div>
                <button type="button" class="ai-icon-button" data-ai-action="play-analysis" aria-label="Read analysis aloud" title="Read aloud">▶</button>
              </div>
              <div class="ai-analysis-text" data-ai-analysis dir="rtl"></div>
              <div class="ai-draft-answer" data-ai-draft hidden dir="rtl"></div>
            </section>

            <section class="ai-sources-section" data-ai-sources-section hidden>
              <div class="ai-section-heading">
                <span class="ai-kicker">Sources</span>
              </div>
              <ol class="ai-source-list" data-ai-sources></ol>
            </section>

            <section class="ai-chat-section">
              <div class="ai-section-heading">
                <span class="ai-kicker">Article conversation</span>
              </div>
              <div class="ai-message-list" data-ai-messages></div>
            </section>
          </div>

          <form class="ai-composer" data-ai-form="message">
            <label class="sr-only" for="aiQuestion">Ask about this article</label>
            <textarea id="aiQuestion" rows="2" maxlength="4000" placeholder="Ask anything about this article..."></textarea>
            <div class="ai-composer-actions">
              <div class="ai-voice-actions">
                <button type="button" class="ai-mic-button" data-ai-action="mic" aria-label="Start push-to-talk" title="Push to talk" data-ai-busy-sensitive>● Mic</button>
                <button type="button" class="ai-text-button" data-ai-action="stop-voice">Stop audio</button>
                <span data-ai-voice-state class="ai-voice-state"></span>
              </div>
              <button type="submit" class="ai-primary-button" data-ai-send data-ai-busy-sensitive>Send</button>
            </div>
          </form>

          <details class="ai-settings">
            <summary>AI settings & privacy</summary>
            <div class="ai-settings-content">
              <form data-ai-form="model" class="ai-model-form">
                <div class="ai-field-group">
                  <label for="aiModel">Active model</label>
                  <div class="ai-key-row">
                    <input id="aiModel" name="model" autocomplete="off" spellcheck="false">
                    <button type="submit" class="ai-secondary-button" data-ai-busy-sensitive>Save</button>
                  </div>
                </div>
              </form>
              <p data-ai-key-status class="ai-key-status"></p>
              <div class="ai-danger-actions">
                <button type="button" data-ai-action="delete-key" class="ai-danger-button">Delete API key</button>
                <button type="button" data-ai-action="clear-all" class="ai-danger-button">Clear all AI history</button>
              </div>
            </div>
          </details>
        </section>
      </div>
    </aside>
  `;
  documentRef.body.append(root);

  const panel = root.querySelector('.ai-panel');
  const views = Object.fromEntries([...root.querySelectorAll('[data-ai-view]')].map(node => [node.dataset.aiView, node]));
  const analysis = root.querySelector('[data-ai-analysis]');
  const draft = root.querySelector('[data-ai-draft]');
  const messages = root.querySelector('[data-ai-messages]');
  const status = root.querySelector('[data-ai-status]');
  const question = root.querySelector('#aiQuestion');
  const keyInput = root.querySelector('#aiApiKey');
  let previousFocus = null;
  const schedule = documentRef.defaultView?.requestAnimationFrame?.bind(documentRef.defaultView)
    || (callback => queueMicrotask(callback));

  function showView(name) {
    for (const [viewName, node] of Object.entries(views)) node.hidden = viewName !== name;
  }

  function open(trigger) {
    if (!root.classList.contains('is-open')) previousFocus = trigger || documentRef.activeElement;
    root.classList.add('is-open');
    panel.setAttribute('aria-hidden', 'false');
    documentRef.body.classList.add('ai-panel-visible');
    schedule(() => panel.querySelector('button, input, textarea, a')?.focus());
  }

  function close() {
    root.classList.remove('is-open');
    panel.setAttribute('aria-hidden', 'true');
    documentRef.body.classList.remove('ai-panel-visible');
    previousFocus?.focus?.();
  }

  function setStatus(message = '', type = 'neutral') {
    status.textContent = message;
    status.dataset.type = type;
    status.hidden = !message;
  }

  function setBusy(isBusy) {
    root.classList.toggle('is-busy', isBusy);
    for (const control of root.querySelectorAll('[data-ai-busy-sensitive]')) control.disabled = isBusy;
  }

  function setArticle(article) {
    root.querySelector('[data-ai-article-title]').textContent = article.title || 'Untitled article';
    root.querySelector('[data-ai-article-source]').textContent = article.source || 'Unknown source';
    root.querySelector('[data-ai-article-time]').textContent = article.publishedAt
      ? new Date(article.publishedAt).toLocaleString()
      : 'Unknown time';
    const link = root.querySelector('[data-ai-article-link]');
    const safeUrl = safeHttpsUrl(article.url);
    link.hidden = !safeUrl;
    if (safeUrl) link.href = safeUrl;
    else link.removeAttribute('href');
  }

  function setAnalysis(value = '', updatedAt = null) {
    analysis.textContent = value;
    analysis.dataset.empty = value ? 'false' : 'true';
    root.querySelector('[data-ai-updated-at]').textContent = updatedAt
      ? `Updated ${new Date(updatedAt).toLocaleString()}`
      : '';
  }

  function setDraftAnswer(value = '') {
    draft.textContent = value;
    draft.hidden = !value;
  }

  function setCitations(citations = []) {
    const list = root.querySelector('[data-ai-sources]');
    const section = root.querySelector('[data-ai-sources-section]');
    list.replaceChildren();
    for (const citation of citations) {
      const url = safeHttpsUrl(citation?.url);
      if (!url) continue;
      const item = documentRef.createElement('li');
      const link = documentRef.createElement('a');
      link.href = url;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = citation.title || new URL(url).hostname;
      item.append(link);
      list.append(item);
    }
    section.hidden = list.children.length === 0;
  }

  function setMessages(items = []) {
    messages.replaceChildren();
    if (!items.length) {
      const empty = documentRef.createElement('p');
      empty.className = 'ai-chat-empty';
      empty.textContent = 'Ask a follow-up by voice or text.';
      messages.append(empty);
      return;
    }
    for (const item of items) {
      const article = documentRef.createElement('article');
      article.className = `ai-message ai-message-${item.role === 'user' ? 'user' : 'model'}`;
      article.dir = 'rtl';
      const body = documentRef.createElement('p');
      body.textContent = item.text;
      article.append(body);
      if (item.role === 'model') {
        const play = button('Read answer aloud', 'play-message', 'ai-icon-button', documentRef);
        play.textContent = '▶';
        play.dataset.messageId = item.id;
        article.append(play);
      }
      messages.append(article);
    }
  }

  function setKeyStatus(keyStatus) {
    if (keyStatus?.exists) {
      root.querySelector('[data-ai-key-status]').textContent = `Groq API key saved on this device ·••••${keyStatus.lastFour}`;
    } else {
      root.querySelector('[data-ai-key-status]').textContent = 'No API key is currently saved.';
    }
  }

  function setKeyError(message = '') {
    root.querySelector('[data-ai-key-error]').textContent = message;
  }

  function setModel(value) {
    root.querySelector('#aiModel').value = value || '';
  }

  function setVoiceState(state = 'idle', message = '') {
    root.dataset.voiceState = state;
    root.querySelector('[data-ai-voice-state]').textContent = message || (state === 'listening' ? 'Listening…' : state === 'speaking' ? 'Speaking…' : '');
  }

  root.addEventListener('click', event => {
    const target = event.target.closest('[data-ai-action]');
    if (!target) return;
    const action = target.dataset.aiAction;
    if (action === 'close') callbacks.onClose?.();
    else if (action === 'open-last') callbacks.onOpenLast?.(target);
    else if (action === 'refresh') callbacks.onRefresh?.();
    else if (action === 'clear-article') callbacks.onClearArticle?.();
    else if (action === 'clear-all') callbacks.onClearAll?.();
    else if (action === 'delete-key') callbacks.onDeleteKey?.();
    else if (action === 'mic') callbacks.onMic?.();
    else if (action === 'stop-voice') callbacks.onStopVoice?.();
    else if (action === 'play-analysis') callbacks.onPlayAnalysis?.();
    else if (action === 'play-message') callbacks.onPlayMessage?.(target.dataset.messageId);
  });

  root.querySelector('[data-ai-form="key"]').addEventListener('submit', event => {
    event.preventDefault();
    callbacks.onSaveKey?.(keyInput.value);
  });
  root.querySelector('[data-ai-form="message"]').addEventListener('submit', event => {
    event.preventDefault();
    callbacks.onSend?.(question.value, 'text');
  });
  root.querySelector('[data-ai-form="model"]').addEventListener('submit', event => {
    event.preventDefault();
    const FormDataConstructor = documentRef.defaultView?.FormData || FormData;
    const form = new FormDataConstructor(event.currentTarget);
    callbacks.onSaveModel?.(form.get('model'));
  });
  question.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      callbacks.onSend?.(question.value, 'text');
    }
  });
  documentRef.addEventListener('keydown', event => {
    if (!root.classList.contains('is-open')) return;
    if (event.key === 'Escape') callbacks.onClose?.();
    if (event.key !== 'Tab') return;
    const focusable = [...panel.querySelectorAll('button:not([disabled]), input:not([disabled]), textarea:not([disabled]), a[href], summary')]
      .filter(element => !element.closest('[hidden]'));
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable.at(-1);
    if (event.shiftKey && documentRef.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && documentRef.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  });

  showView('empty');
  setStatus();
  setMessages([]);

  return {
    open,
    close,
    showEmpty: () => showView('empty'),
    showSetup: error => {
      showView('setup');
      setKeyError(error || '');
      schedule(() => keyInput.focus());
    },
    showWorkspace: () => showView('workspace'),
    setStatus,
    setBusy,
    setArticle,
    setAnalysis,
    setDraftAnswer,
    setCitations,
    setMessages,
    setKeyStatus,
    setKeyError,
    setModel,
    setVoiceState,
    setQuestion: value => { question.value = value || ''; },
    clearQuestion: () => { question.value = ''; },
    clearKeyInput: () => { keyInput.value = ''; },
    getRoot: () => root,
    isOpen: () => root.classList.contains('is-open'),
  };
}
