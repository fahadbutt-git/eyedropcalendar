// Reads text aloud with the phone's own voice. In the app this uses the
// operating system's speech engine. In a browser it uses only voices that
// run on the device (localService), so the words never go to a server. When
// no on-device voice exists, canSpeak() is false and no button is shown.
import { Capacitor } from "@capacitor/core";
import { TextToSpeech } from "@capacitor-community/text-to-speech";

const native = Capacitor.isNativePlatform();
const web = typeof window !== "undefined" && "speechSynthesis" in window ? window.speechSynthesis : null;
const RATE = 0.9;

function localVoice() {
  const voices = web?.getVoices().filter((v) => v.localService) || [];
  const lang = (navigator.language || "en-CA").toLowerCase();
  return (
    voices.find((v) => v.lang.toLowerCase() === lang) ||
    voices.find((v) => v.lang.toLowerCase().startsWith(lang.slice(0, 2))) ||
    voices.find((v) => v.lang.toLowerCase().startsWith("en")) ||
    null
  );
}

// Voices load late in some browsers, so callers listen for a change.
export function canSpeak() {
  return native || !!localVoice();
}
export function onVoicesChanged(callback) {
  if (!web || native) return () => {};
  web.addEventListener?.("voiceschanged", callback);
  return () => web.removeEventListener?.("voiceschanged", callback);
}

export async function speak(text) {
  if (native) {
    await TextToSpeech.stop().catch(() => {});
    return TextToSpeech.speak({ text, lang: navigator.language || "en-CA", rate: RATE, category: "playback" });
  }
  const voice = localVoice();
  if (!voice) return;
  web.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = RATE;
  web.speak(u);
}

export function stopSpeaking() {
  if (native) return TextToSpeech.stop().catch(() => {});
  web?.cancel();
}
