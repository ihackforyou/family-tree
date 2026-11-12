import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';

/** Speech-to-text via the browser's Web Speech API (Chrome / Edge send audio to their speech service). */
interface RecognitionResultEvent {
  resultIndex: number;
  results: ArrayLike<{ isFinal: boolean; 0: { transcript: string } }>;
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((e: RecognitionResultEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
}
type RecognitionCtor = new () => Recognition;

const getCtor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

export function useSpeech(onText: (finalText: string) => void) {
  const supported = typeof window !== 'undefined' && !!getCtor();
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<Recognition | null>(null);
  const cb = useRef(onText);
  useEffect(() => { cb.current = onText; }, [onText]);

  const stop = useCallback(() => rec.current?.stop(), []);
  const start = useCallback((lang: 'hi-IN' | 'en-IN') => {
    const Ctor = getCtor();
    if (!Ctor) return;
    rec.current?.stop();
    const r = new Ctor();
    r.lang = lang;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let live = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) cb.current(res[0].transcript.trim());
        else live += res[0].transcript;
      }
      setInterim(live);
    };
    r.onerror = (e) => setError(e.error === 'not-allowed' ? t('err.micDenied') : t('err.voice', { e: e.error }));
    r.onend = () => { setListening(false); setInterim(''); };
    setError(null);
    rec.current = r;
    r.start();
    setListening(true);
  }, []);

  useEffect(() => () => rec.current?.stop(), []);
  return { supported, listening, interim, error, start, stop };
}
