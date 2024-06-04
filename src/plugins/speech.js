import { hookMethod } from '@merkur/core';

import { CZ_DICTIONARY } from '../dictionaries/cz';

export const EVENTS = {
  PLAY: 'event.play',
  PAUSE: 'event.pause',
  RESUME: 'event.resume',
  SPEAKING: 'event.speaking',
  END: 'event.end',
  CANCEL: 'event.cancel',
  ERROR: 'event.error',
};

export const COMMANDS = {
  PLAY: 'command.play',
  PAUSE: 'command.pause',
  CANCEL: 'command.cancel',
};

export function speechPlugin() {
  return {
    setup(widget) {
      widget.$external = {
        ...widget.$external,
        timer: null,
        lang: document.querySelector('html')?.getAttribute('lang') ?? 'en',
        voice: null,
        speech: null,
      };

      return {
        ...widget,
        ...speechAPI(),
      };
    },
    async create(widget) {
      const speech = speechInternalAPI(widget);

      hookMethod(widget, '$in.component.lifeCycle.load', (widget, original) => {
        return {
          cursor: 0,
          time: 0,
          texts: [],
          playing: false,
          paused: false,
          error: null,
          ...original(),
        };
      });

      window.speechSynthesis.cancel();
      await speech.pickVoice();

      widget.on(widget, EVENTS.END, () => {
        widget.emit(COMMANDS.CANCEL);
      });

      widget.on(widget, EVENTS.ERROR, (event) => {
        widget.setState({
          playing: false,
          paused: false,
          error: event.error,
        });

        //widget.emit(COMMANDS.CANCEL);

        console.error(event);
      });

      widget.on(widget, COMMANDS.PLAY, (...rest) => {
        speech.onPlay(...rest);

        widget.$external.timer = setInterval(() => {
          widget.setState({ time: widget.state.time + 1000 });
        }, 1000);
      });

      widget.on(widget, COMMANDS.PAUSE, (...rest) => {
        clearInterval(widget.$external.timer);
        widget.$external.timer = null;

        speech.onPause(...rest);
      });

      widget.on(widget, COMMANDS.CANCEL, (...rest) => {
        clearInterval(widget.$external.timer);
        widget.$external.timer = null;

        speech.onCancel(...rest);
      });

      return widget;
    },
  };
}

function speechInternalAPI(widget) {
  return {
    onPlay() {
      const { playing, paused } = widget.state;
      if (playing) {
        return;
      }

      // TODO cancel instead of resume ? if android
      if (paused) {
        window.speechSynthesis.resume();

        widget.setState({ playing: true, paused: false });
        return;
      }

      // parse content from page
      if (widget.state.texts.length === 0) {
        this.onParse();
      }

      const { texts } = widget.state;
      const speech = this.createSpeech();
      const speechText = texts.reduce((result, speakable) => {
        return result + speakable.text;
      }, '');

      if (typeof speechText !== 'string' || speechText.length === 0) {
        return;
      }

      speech.text = this.transform(speech, speechText);
      window.speechSynthesis.speak(speech);
      widget.setState({ playing: true, paused: false });
    },
    onParse() {
      widget.setState({
        texts: [
          ...widget.state.texts,
          ...Array.from(document.querySelectorAll('.speakable')).map(
            (element) => ({ element: element, text: element.textContent })
          ),
        ],
      });
    },
    onCancel(force) {
      window.speechSynthesis.cancel();

      widget.setState({
        cursor: 0,
        time: 0,
        texts: [],
        error: widget.state.error && !force ? widget.state.error : null,
        playing: false,
        paused: false,
      });
      widget.$external.events =
        widget.state.error && !force ? widget.$external.events : [];
      widget.$external.speech = null;

      widget.emit(EVENTS.CANCEL);
    },
    onPause() {
      widget.setState({ playing: false, paused: true });
      window.speechSynthesis.pause();
    },
    createSpeech() {
      const speech = new SpeechSynthesisUtterance();
      speech.lang = widget.$external.lang;
      speech.pitch = 1;
      speech.rate = 1;
      speech.voice = widget.$external.voice;

      speech.addEventListener('end', () => {
        widget.emit(EVENTS.END);
        widget.$external.events.push(EVENTS.END);
      });

      speech.addEventListener('start', () => {
        widget.emit(EVENTS.PLAY);
        widget.$external.events.push(EVENTS.PLAY);
      });
      speech.addEventListener('resume', () => {
        widget.emit(EVENTS.PLAY);
        widget.$external.events.push(`${EVENTS.PLAY}/${EVENTS.RESUME}`);
      });
      speech.addEventListener('pause', () => {
        widget.emit(EVENTS.PAUSE);
        widget.$external.events.push(EVENTS.PAUSE);
      });
      speech.addEventListener('error', (event) => {
        widget.emit(EVENTS.ERROR, event);

        widget.$external.events.push('error', event?.error);
      });
      speech.addEventListener('boundary', (data) => {
        widget.emit(EVENTS.SPEAKING, data);

        widget.setState({ cursor: data.charIndex + data.charLength });
      });
      widget.$external.speech = speech;

      return speech;
    },
    transform(speech, text) {
      if (speech.lang === 'cs' || speech.lang === 'cz') {
        return CZ_DICTIONARY.reduce((result, [pattern, replacement, flags]) => {
          return result.replaceAll(
            new RegExp(pattern, `${flags ? flags : ''}g`),
            replacement
          );
        }, text);
      }

      return text;
    },
    async pickVoice() {
      const voices = await new Promise((resolve) => {
        let voices = window.speechSynthesis.getVoices();
        if (voices.length !== 0) {
          resolve(voices);
        } else {
          window.speechSynthesis.addEventListener(
            'voiceschanged',
            () => {
              voices = window.speechSynthesis.getVoices();
              resolve(voices);
            },
            { once: true }
          );
        }
      });

      widget.$external.voice =
        voices.filter((voice) =>
          new RegExp(widget.$external.lang, 'ig').test(voice.lang)
        )[0] ?? voices[0];
    },
  };
}

function speechAPI() {
  return {
    getTimeRemaining(widget) {
      const { cursor } = widget.state;
      if (!widget.$external.speech) {
        return 0;
      }

      let { right: remaining } = sliceByCursor(
        widget.$external.speech.text,
        cursor
      );

      if (remaining === '') {
        return 0;
      }

      return widget.getReadingTime(remaining);
    },
    getReadingTime(widget, text) {
      if (!text) {
        return 0;
      }

      const words = text.match(/\b/g).length / 2;
      return (words / (180 / 60)) * 1000;
    },
  };
}

function sliceByCursor(str, cursor) {
  return {
    left: str?.slice(0, cursor) ?? '',
    right: str?.slice(cursor, str.length) ?? str,
  };
}
