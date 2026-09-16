import { createAssistantView } from './assistant-view.js';
import { DEFAULT_GROQ_MODEL, streamGroqWithFallback, testGroqKey } from './groq-provider.js';
import {
  clearAiHistory,
  createEmptySession,
  deleteArticleSession,
  getAiSetting,
  getArticleSession,
  saveArticleSession,
  setAiSetting,
  articleSnapshot,
} from './history-store.js';
import { deleteApiKey, getApiKey, getApiKeyStatus, saveApiKey, validateApiKey } from './key-store.js';
import {
  buildGroqChatMessages,
  buildGroqInitialMessages,
} from './prompt.js';
import { createVoiceController } from './voice-controller.js';

function uniqueCitations(article, citations = []) {
  const values = [];
  const seen = new Set();
  const add = citation => {
    try {
      const url = new URL(citation?.url);
      if (url.protocol !== 'https:' || seen.has(url.href)) return;
      seen.add(url.href);
      values.push({ url: url.href, title: String(citation.title || url.hostname).slice(0, 300) });
    } catch {
      // Ignore malformed provider or feed URLs.
    }
  };
  add({ url: article?.url, title: article?.source ? `${article.source} · Original article` : 'Original article' });
  for (const citation of citations) add(citation);
  return values;
}

function messageId(role) {
  return `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createAiAssistant({
  getArticleById = () => null,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
} = {}) {
  let view;
  let activeArticle = null;
  let activeSession = null;
  let activeController = null;
  let activeRequestId = null;
  let activeOpenId = null;
  let listening = false;
  const voice = createVoiceController({ windowRef, locale: 'ar-EG' });

  function errorMessage(error) {
    return error?.message || 'The AI request failed. Please try again.';
  }

  function abortActiveRequest() {
    activeRequestId = null;
    activeController?.abort();
    activeController = null;
  }

  function renderSession() {
    if (!activeSession) return;
    view.setAnalysis(activeSession.analysis || '', activeSession.updatedAt);
    view.setCitations(activeSession.citations || []);
    view.setMessages(activeSession.messages || []);
    view.setDraftAnswer('');
  }

  async function refreshKeyStatus() {
    const status = await getApiKeyStatus();
    view.setKeyStatus(status);
    return status;
  }

  async function currentModel() {
    const savedGroq = await getAiSetting('groq_model', null);
    return savedGroq || DEFAULT_GROQ_MODEL;
  }

  async function adoptFallbackModel(aiResponse) {
    if (!aiResponse.fallbackFrom) return false;
    await setAiSetting('groq_model', aiResponse.model);
    view.setModel(aiResponse.model);
    return true;
  }

  async function openArticle(article, trigger) {
    if (!article?.id) return;
    const openId = Symbol('open-article');
    const selectedArticle = articleSnapshot(article);
    activeOpenId = openId;
    abortActiveRequest();
    voice.cancelAll();
    listening = false;
    activeArticle = selectedArticle;
    activeSession = null;

    view.open(trigger);
    view.setArticle(selectedArticle);
    view.setVoiceState('idle');
    view.showWorkspace();
    view.setBusy(true);
    view.setStatus('Loading saved AI context…', 'loading');

    const storedSession = await getArticleSession(selectedArticle.id);
    if (activeOpenId !== openId) return;
    activeSession = storedSession || createEmptySession(selectedArticle);
    await setAiSetting('lastArticleId', selectedArticle.id);
    if (activeOpenId !== openId) return;
    renderSession();
    const keyStatus = await refreshKeyStatus();
    if (activeOpenId !== openId) return;
    const model = await currentModel();
    if (activeOpenId !== openId) return;
    view.setModel(model);
    view.setBusy(false);

    if (activeSession.analysis) {
      view.showWorkspace();
      view.setStatus(keyStatus.exists
        ? 'Loaded from this device. Refresh when you want a new analysis.'
        : 'Loaded from this device. Add an API key to refresh or ask new questions.', 'neutral');
      return;
    }
    if (!keyStatus.exists) {
      view.showSetup();
      return;
    }
    view.showWorkspace();
    await analyzeArticle();
  }

  async function openLast(trigger) {
    if (activeArticle) {
      view.open(trigger);
      return;
    }
    const articleId = await getAiSetting('lastArticleId', null);
    if (!articleId) {
      view.open(trigger);
      view.showEmpty();
      return;
    }
    const liveArticle = getArticleById(articleId);
    const storedSession = await getArticleSession(articleId);
    const article = liveArticle || storedSession?.article;
    if (article) await openArticle(article, trigger);
    else {
      view.open(trigger);
      view.showEmpty();
    }
  }

  async function saveAndTestKey(value) {
    view.setKeyError('');
    view.setBusy(true);
    try {
      const key = validateApiKey(value);
      let model = await currentModel();
      const testResult = await testGroqKey({ apiKey: key, model });
      model = testResult.name;
      await setAiSetting('groq_model', model);
      await saveApiKey(key);
      view.setModel(model);
      view.clearKeyInput();
      await refreshKeyStatus();
      view.setStatus('Groq key tested and saved on this device.', 'success');
      if (activeArticle) {
        view.showWorkspace();
        renderSession();
        if (!activeSession?.analysis) await analyzeArticle();
      } else {
        view.showEmpty();
      }
    } catch (error) {
      view.setKeyError(errorMessage(error));
    } finally {
      view.setBusy(false);
    }
  }

  async function requireKey() {
    const key = await getApiKey();
    if (key) return key;
    view.showSetup('Add a Groq key before making a new AI request.');
    return null;
  }

  async function analyzeArticle() {
    if (!activeArticle) return;
    const articleId = activeArticle.id;
    const apiKey = await requireKey();
    if (!apiKey || activeArticle?.id !== articleId) return;

    abortActiveRequest();
    const requestId = Symbol('analysis');
    const controller = new AbortController();
    activeRequestId = requestId;
    activeController = controller;
    const previousAnalysis = activeSession?.analysis || '';
    view.showWorkspace();
    view.setBusy(true);
    view.setStatus('Reading the selected article and preparing brief…', 'loading');
    view.setAnalysis('', null);
    view.setCitations([]);

    try {
      const result = await streamGroqWithFallback({
        apiKey,
        model: await currentModel(),
        messages: buildGroqInitialMessages(activeArticle),
        signal: controller.signal,
        onText: (_delta, fullText) => {
          if (activeRequestId === requestId) view.setAnalysis(fullText);
        },
      });

      if (activeRequestId !== requestId) return;
      const modelChanged = await adoptFallbackModel(result);
      const citations = uniqueCitations(activeArticle, result.citations || []);
      activeSession = await saveArticleSession({
        ...(activeSession || createEmptySession(activeArticle)),
        article: activeArticle,
        analysis: result.text,
        citations,
      });
      renderSession();
      const modelNotice = modelChanged ? `Switched automatically to ${result.model}. ` : '';
      view.setStatus(`${modelNotice}Analysis completed successfully.`, 'success');
    } catch (error) {
      if (error?.code !== 'aborted' && activeRequestId === requestId) {
        view.setAnalysis(previousAnalysis, activeSession?.updatedAt);
        view.setStatus(errorMessage(error), 'error');
      }
    } finally {
      if (activeRequestId === requestId) {
        activeRequestId = null;
        activeController = null;
        view.setBusy(false);
      }
    }
  }

  async function sendQuestion(value, origin = 'text') {
    const question = String(value || '').trim();
    if (!question || !activeArticle) return;
    const articleId = activeArticle.id;
    const apiKey = await requireKey();
    if (!apiKey || activeArticle?.id !== articleId) return;

    abortActiveRequest();
    const requestId = Symbol('chat');
    const controller = new AbortController();
    activeRequestId = requestId;
    activeController = controller;
    activeSession ||= createEmptySession(activeArticle);
    activeSession.messages = [
      ...(activeSession.messages || []),
      { id: messageId('user'), role: 'user', text: question, origin, createdAt: new Date().toISOString() },
    ];
    activeSession = await saveArticleSession(activeSession);
    view.clearQuestion();
    view.setMessages(activeSession.messages);
    view.setBusy(true);
    view.setStatus('Checking the article…', 'loading');

    try {
      const result = await streamGroqWithFallback({
        apiKey,
        model: await currentModel(),
        messages: buildGroqChatMessages(activeArticle, activeSession),
        signal: controller.signal,
        onText: (_delta, fullText) => {
          if (activeRequestId === requestId) view.setDraftAnswer(fullText);
        },
      });

      if (activeRequestId !== requestId) return;
      const modelChanged = await adoptFallbackModel(result);
      const reply = {
        id: messageId('model'),
        role: 'model',
        text: result.text,
        origin,
        createdAt: new Date().toISOString(),
      };
      activeSession = await saveArticleSession({
        ...activeSession,
        messages: [...activeSession.messages, reply],
        citations: uniqueCitations(activeArticle, [...(activeSession.citations || []), ...(result.citations || [])]),
      });
      renderSession();
      const modelNotice = modelChanged ? `Switched automatically to ${result.model}. ` : '';
      view.setStatus(`${modelNotice}Answer completed successfully.`, 'success');
      if (origin === 'voice') speakText(reply.text);
    } catch (error) {
      if (error?.code !== 'aborted' && activeRequestId === requestId) {
        view.setDraftAnswer('');
        view.setStatus(errorMessage(error), 'error');
      }
    } finally {
      if (activeRequestId === requestId) {
        activeRequestId = null;
        activeController = null;
        view.setBusy(false);
      }
    }
  }

  function speakText(text) {
    if (!text || !text.trim()) {
      view.setStatus('No text is available to read aloud. Please analyze an article first.', 'warning');
      return;
    }
    if (!voice.supportsSpeech()) {
      view.setStatus('Arabic speech playback is not available in this browser. The text remains visible.', 'warning');
      return;
    }
    const started = voice.speak(text, {
      onState: state => view.setVoiceState(state),
      onError: () => view.setStatus('Speech playback stopped or requires an Arabic voice installed in your browser/system.', 'warning'),
    });
    if (!started) {
      view.setStatus('Arabic speech playback is not available in this browser. The text remains visible.', 'warning');
    }
  }

  function toggleMic() {
    if (listening) {
      voice.stopListening();
      listening = false;
      view.setVoiceState('idle');
      return;
    }
    const started = voice.startListening({
      onTranscript: transcript => view.setQuestion(transcript),
      onFinal: transcript => {
        listening = false;
        view.setQuestion(transcript);
        sendQuestion(transcript, 'voice');
      },
      onState: state => {
        listening = state === 'listening';
        view.setVoiceState(state);
      },
      onError: error => {
        listening = false;
        view.setStatus(errorMessage(error), 'warning');
      },
    });
    if (!started) listening = false;
  }

  async function clearCurrentArticle() {
    if (!activeArticle || !windowRef.confirm('Clear the saved AI analysis and conversation for this article?')) return;
    abortActiveRequest();
    voice.cancelAll();
    await deleteArticleSession(activeArticle.id);
    activeSession = createEmptySession(activeArticle);
    renderSession();
    view.setStatus('This article AI history was cleared. Use Refresh from web to analyze it again.', 'success');
  }

  async function clearAllHistory() {
    if (!windowRef.confirm('Clear all locally saved AI analyses and conversations?')) return;
    abortActiveRequest();
    voice.cancelAll();
    await clearAiHistory();
    activeSession = activeArticle ? createEmptySession(activeArticle) : null;
    if (activeSession) renderSession();
    view.setStatus('All local AI history was cleared. Your API key was kept.', 'success');
  }

  async function removeKey() {
    if (!windowRef.confirm('Delete the AI API key from this device?')) return;
    abortActiveRequest();
    await deleteApiKey();
    await refreshKeyStatus();
    view.setStatus('The API key was deleted from this device.', 'success');
  }

  async function saveModel(value) {
    const model = String(value || '').trim();
    if (!/^[a-zA-Z0-9._-]{3,100}$/.test(model)) {
      view.setStatus('Enter a valid model name.', 'error');
      return;
    }
    await setAiSetting('groq_model', model);
    view.setModel(model);
    view.setStatus('Groq model preference saved on this device.', 'success');
  }

  function close() {
    activeOpenId = null;
    abortActiveRequest();
    voice.cancelAll();
    listening = false;
    view.setVoiceState('idle');
    view.setBusy(false);
    view.close();
  }

  async function mount() {
    if (view) return;
    view = createAssistantView({
      onClose: close,
      onOpenLast: openLast,
      onSaveKey: saveAndTestKey,
      onRefresh: analyzeArticle,
      onSend: sendQuestion,
      onMic: toggleMic,
      onStopVoice: () => {
        voice.cancelAll();
        listening = false;
        view.setVoiceState('idle');
      },
      onPlayAnalysis: () => speakText(activeSession?.analysis || ''),
      onPlayMessage: id => speakText(activeSession?.messages?.find(message => message.id === id)?.text || ''),
      onClearArticle: clearCurrentArticle,
      onClearAll: clearAllHistory,
      onDeleteKey: removeKey,
      onSaveModel: saveModel,
    }, documentRef);
    view.setModel(await currentModel());
    await refreshKeyStatus();
  }

  return {
    mount,
    openArticle,
    openLast,
    close,
    getActiveArticle: () => activeArticle,
  };
}
