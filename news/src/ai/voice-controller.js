function recognitionConstructor(windowRef) {
  return windowRef?.SpeechRecognition || windowRef?.webkitSpeechRecognition || null;
}

export function cleanSpeechText(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/(?:https?:\/\/|www\.)\S+/giu, ' ')
    .replace(/[`*_#<>~^=+@©®™]+/gu, ' ')
    .replace(/[\r\n]+/g, '. ')
    .replace(/[\/\\|:;!?؟–—-]+/gu, '. ')
    .replace(/[,،]+/gu, ', ')
    .replace(/[^\p{L}\p{M}\p{N}\s.,]/gu, ' ')
    .replace(/\s*\.\s*/g, '. ')
    .replace(/\s*,\s*/g, ', ')
    .replace(/(?:\.\s*){2,}/g, '. ')
    .replace(/\s+/g, ' ')
    .replace(/^[.,\s]+|[.,\s]+$/g, '')
    .trim();
}

export function createVoiceController({ windowRef = globalThis.window, locale = 'ar-EG' } = {}) {
  let recognition = null;

  function supportsRecognition() {
    return Boolean(recognitionConstructor(windowRef));
  }

  function supportsSpeech() {
    return Boolean(windowRef?.speechSynthesis && windowRef?.SpeechSynthesisUtterance);
  }

  function stopListening() {
    if (!recognition) return;
    try {
      recognition.stop();
    } catch {
      // Recognition may already be stopped by the browser.
    }
  }

  function startListening({ onTranscript = () => {}, onFinal = () => {}, onState = () => {}, onError = () => {} } = {}) {
    const Recognition = recognitionConstructor(windowRef);
    if (!Recognition) {
      onError(new Error('Speech recognition is not supported by this browser.'));
      return false;
    }

    stopListening();
    recognition = new Recognition();
    recognition.lang = locale;
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    let finalDelivered = false;

    recognition.onstart = () => onState('listening');
    recognition.onresult = event => {
      let transcript = '';
      let hasFinalResult = false;
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        transcript += event.results[index][0]?.transcript || '';
        if (event.results[index].isFinal) hasFinalResult = true;
      }
      transcript = transcript.trim();
      if (transcript) onTranscript(transcript);
      if (transcript && hasFinalResult && !finalDelivered) {
        finalDelivered = true;
        onFinal(transcript);
      }
    };
    recognition.onerror = event => {
      const message = event?.error === 'not-allowed'
        ? 'Microphone permission was denied. You can continue by typing.'
        : 'Voice recognition failed. You can continue by typing.';
      onState('error');
      onError(new Error(message));
    };
    recognition.onend = () => {
      onState('idle');
      recognition = null;
    };

    try {
      recognition.start();
      return true;
    } catch (error) {
      recognition = null;
      onState('error');
      onError(error);
      return false;
    }
  }

  function cancelSpeech() {
    windowRef?.speechSynthesis?.cancel();
  }

  function speak(value, { rate = 0.95, voiceName = '', onState = () => {}, onError = () => {} } = {}) {
    const speechText = cleanSpeechText(value);
    if (!speechText || !supportsSpeech()) return false;

    cancelSpeech();
    try {
      if (windowRef?.speechSynthesis?.paused) {
        windowRef.speechSynthesis.resume?.();
      }
    } catch {
      // Ignore synthesis resume errors.
    }

    const utterance = new windowRef.SpeechSynthesisUtterance(speechText);
    utterance.lang = locale;
    utterance.rate = Math.min(1.4, Math.max(0.7, Number(rate) || 1));
    const voices = windowRef.speechSynthesis.getVoices?.() || [];
    utterance.voice = voices.find(voice => voice.name === voiceName)
      || voices.find(voice => voice.lang?.toLowerCase() === locale.toLowerCase())
      || voices.find(voice => voice.lang?.toLowerCase().startsWith('ar'))
      || null;
    utterance.onstart = () => onState('speaking');
    utterance.onend = () => onState('idle');
    utterance.onerror = event => {
      onState('error');
      onError(event);
    };
    windowRef.speechSynthesis.speak(utterance);
    return true;
  }

  function cancelAll() {
    stopListening();
    cancelSpeech();
  }

  return {
    supportsRecognition,
    supportsSpeech,
    startListening,
    stopListening,
    speak,
    cancelSpeech,
    cancelAll,
  };
}
