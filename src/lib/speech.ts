/**
 * Live captions + on-device translation. Both are progressive enhancements:
 *  - Speech recognition uses the Web Speech API (Chrome/Edge). Absent elsewhere.
 *  - Translation uses Chrome's built-in on-device Translator API when present,
 *    otherwise the original text is shown unchanged.
 * Nothing is sent to any third-party server.
 */

export function isSpeechSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition)
  );
}

export class CaptionRecognizer {
  private rec: SpeechRecognition | null = null;
  private stopped = false;

  constructor(
    private readonly lang: string,
    private readonly onFinal: (text: string) => void,
  ) {}

  start(): void {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Ctor) return;
    this.stopped = false;
    const rec = new Ctor();
    rec.lang = this.lang || 'en';
    rec.continuous = true;
    rec.interimResults = false;
    rec.onresult = (event: SpeechRecognitionEvent) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          const text = result[0].transcript.trim();
          if (text) this.onFinal(text);
        }
      }
    };
    // The API stops on silence; restart to keep it continuous.
    rec.onend = () => {
      if (!this.stopped) {
        try {
          rec.start();
        } catch {
          /* already starting */
        }
      }
    };
    rec.onerror = () => {};
    this.rec = rec;
    try {
      rec.start();
    } catch {
      /* noop */
    }
  }

  stop(): void {
    this.stopped = true;
    try {
      this.rec?.stop();
    } catch {
      /* noop */
    }
    this.rec = null;
  }
}

const translators = new Map<string, Promise<TranslatorInstance | null>>();

async function getTranslator(
  from: string,
  to: string,
): Promise<TranslatorInstance | null> {
  const key = `${from}:${to}`;
  if (!translators.has(key)) {
    translators.set(
      key,
      (async () => {
        try {
          if (typeof Translator === 'undefined') return null;
          const status = await Translator.availability({
            sourceLanguage: from,
            targetLanguage: to,
          });
          if (status === 'unavailable') return null;
          return await Translator.create({
            sourceLanguage: from,
            targetLanguage: to,
          });
        } catch {
          return null;
        }
      })(),
    );
  }
  return translators.get(key)!;
}

/** Translates text on-device, returning the original on any failure. */
export async function translateText(
  text: string,
  from: string,
  to: string,
): Promise<string> {
  if (from === to) return text;
  const translator = await getTranslator(from, to);
  if (!translator) return text;
  try {
    return await translator.translate(text);
  } catch {
    return text;
  }
}
