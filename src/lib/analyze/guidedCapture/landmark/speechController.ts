/**
 * Browser SpeechSynthesis helper — failure must not block capture.
 */

"use client";

import {
  detectSpeechSupport,
  resolveCaptureVoiceLocale,
  speechLangForLocale,
  type CaptureVoiceLocale,
} from "./voiceMessages";

export type CaptureSpeechController = {
  locale: CaptureVoiceLocale;
  enabled: boolean;
  ready: boolean;
  prepareFromUserGesture: () => void;
  speak: (text: string) => void;
  cancel: () => void;
  setEnabled: (on: boolean) => void;
  dispose: () => void;
};

export function createCaptureSpeechController(input: {
  localeTag: string;
  enabled: boolean;
}): CaptureSpeechController {
  let enabled = input.enabled;
  let locale = resolveCaptureVoiceLocale(input.localeTag);
  let ready = false;
  let disposed = false;

  function cancel() {
    try {
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // ignore
    }
  }

  return {
    get locale() {
      return locale;
    },
    get enabled() {
      return enabled;
    },
    get ready() {
      return ready;
    },
    prepareFromUserGesture() {
      if (disposed || typeof window === "undefined") return;
      const support = detectSpeechSupport(window);
      if (!support.supported) {
        ready = false;
        return;
      }
      try {
        // Unlock voices list without audible surprise when possible.
        window.speechSynthesis.getVoices();
        ready = true;
      } catch {
        ready = false;
      }
    },
    speak(text: string) {
      if (disposed || !enabled || !text.trim()) return;
      if (typeof window === "undefined") return;
      const support = detectSpeechSupport(window);
      if (!support.supported) return;
      try {
        cancel();
        const u = new SpeechSynthesisUtterance(text);
        u.lang = speechLangForLocale(locale);
        const voices = window.speechSynthesis.getVoices();
        const match = voices.find((v) =>
          v.lang.toLowerCase().startsWith(locale === "zh-CN" ? "zh" : locale)
        );
        if (match) u.voice = match;
        u.rate = 1;
        window.speechSynthesis.speak(u);
      } catch {
        // Voice failure must not block capture.
      }
    },
    cancel,
    setEnabled(on: boolean) {
      enabled = on;
      if (!on) cancel();
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
