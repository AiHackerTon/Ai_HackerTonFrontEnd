export function speak(text) {
  if (!("speechSynthesis" in window)) return alert("이 브라우저는 TTS를 지원하지 않아요.");
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "ko-KR";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}
