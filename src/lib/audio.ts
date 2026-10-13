export function speakJapanese(text: string, rate = 0.85) {
  if (!('speechSynthesis' in window) || !text.trim()) return;

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'ja-JP';
  utterance.rate = rate;
  window.speechSynthesis.speak(utterance);
}

export function stopJapaneseSpeech() {
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
}