import { CZ_DICTIONARY } from '../dictionaries/cz';
import { hookMethod } from '@merkur/core';

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

// function sliceByCursor(str, cursor) {
//   return {
//     left: str?.slice(0, cursor) ?? '',
//     right: str?.slice(cursor, str.length) ?? str,
//   };
// }

// export const widgetProperties = {
//   name: '@merkur/speakable',
//   version,
//   $plugins: [componentPlugin, eventEmitterPlugin],
//   assets: [],
//   async setup(widget) {
//     const container = document.createElement('div');
//     container.style = `position: fixed; z-index: 10000;`;
//     widget.$external = {
//       ...widget.$external,
//       container,
//       wakeLock: null,
//       events: [],
//       lang: document.querySelector('html')?.getAttribute('lang') ?? 'en',
//       voice: null,
//       audio: null,
//     };

//     return widget;
//   },
//   async bootstrap(widget) {
//     window.speechSynthesis.cancel();
//     await widget.pickVoice();
//     await widget.createAudio();

//     return widget;
//   },
//   load() {
//     return {
//       debug: false,
//       open: true,
//       cursor: 0,
//       time: 0,
//       texts: [],
//       textIndex: 0,
//       playing: false,
//       paused: false,
//       error: null,
//     };
//   },
//   mount(widget) {
//     widget.root.appendChild(widget.$external.container);

//     const { style } = widget.$external.container;
//     style.setProperty('bottom', `0px`);
//     style.setProperty('right', `0px`);

//     this.update(widget);
//   },
//   unmount() {
//     // TODO
//   },
//   update(widget) {
//     render(<Speakable widget={widget} />, widget.$external.container);
//   },
//   onPrevious(widget) {
//     window.speechSynthesis.cancel();

//     clearTimeout(widget.$external.timeout);
//     widget.$external.timeout = null;

//     const { playing } = widget.state;
//     widget.setState({
//       cursor: 0,
//       playing: false,
//       paused: false,
//       textIndex: Math.max(0, widget.state.textIndex - 1),
//     });
//     if (playing) {
//       widget.onPlay();
//     }
//   },
//   onNext(widget) {
//     window.speechSynthesis.cancel();

//     clearTimeout(widget.$external.timeout);
//     widget.$external.timeout = null;

//     const { playing } = widget.state;
//     widget.setState({
//       cursor: 0,
//       playing: false,
//       paused: false,
//       textIndex: Math.min(
//         widget.state.texts.length - 1,
//         widget.state.textIndex + 1
//       ),
//     });
//     if (playing) {
//       widget.onPlay();
//     }
//   },
//   onParse(widget) {
//     widget.setState({
//       texts: [
//         ...widget.state.texts,
//         ...Array.from(document.querySelectorAll('.speakable')).map(
//           (element) => element.textContent
//         ),
//       ],
//       textIndex: 0,
//     });
//   },
//   onPlay(widget) {
//     const { playing, paused } = widget.state;
//     if (playing) {
//       return;
//     }

//     widget.lock();

//     if (!widget.$external.interval) {
//       widget.$external.interval = setInterval(() => {
//         widget.setState({ time: widget.state.time + 1000 });

//         if (
//           widget.state.textIndex + 1 < widget.state.texts.length &&
//           !window.speechSynthesis.speaking &&
//           widget.state.playing
//         ) {
//           widget.$external.events.push('bug next ' + widget.state.textIndex);
//           widget.onNext();
//         }
//       }, 1000);
//     }

//     if (paused) {
//       window.speechSynthesis.resume();

//       widget.setState({ playing: true, paused: false });
//       widget.$external.audio.play();
//       return;
//     }

//     // parse content from page
//     if (widget.state.texts.length === 0) {
//       widget.onParse();
//     }

//     const { texts, textIndex } = widget.state;

//     // texts.slice(textIndex, texts.length).forEach((text) => {
//     //   const speech = widget.createSpeech();

//     //   if (typeof text !== 'string' || text.length === 0) {
//     //     return;
//     //   }

//     //   speech.text = widget.transform(speech, text);
//     //   window.speechSynthesis.speak(speech);
//     // });

//     const speech = widget.createSpeech();

//     const speechText = texts[textIndex];
//     if (typeof speechText !== 'string' || speechText.length === 0) {
//       return;
//     }

//     speech.text = widget.transform(speech, speechText);

//     const readingTime = widget.getReadingTime(speech.text);
//     widget.$external.timeout = setTimeout(() => {
//       if (widget.state.textIndex + 1 < widget.state.texts.length) {
//         widget.$external.events.push('timeout next ' + widget.state.textIndex);
//         widget.onNext();
//       } else {
//         widget.$external.events.push(
//           'timeout cancel ' + widget.state.textIndex
//         );
//         widget.onCancel();
//       }
//     }, Math.min(readingTime * 2, readingTime + 4000));

//     try {
//       window.speechSynthesis.speak(speech);
//       widget.setState({ playing: true, paused: false });

//       createAudioSource(widget.$external.audio, readingTime);

//       widget.$external.audio
//         .play()
//         .then(() => {
//           widget.updateMetaData();
//         })
//         .catch((e) => {
//           widget.$external.events.push('audio play error ' + e.message);
//         });
//     } catch (e) {
//       widget.$external.events.push('error play ' + e.message);
//     }
//   },
//   onCancel(widget) {
//     clearInterval(widget.$external.interval);
//     widget.$external.interval = null;
//     clearTimeout(widget.$external.timeout);
//     widget.$external.timeout = null;
//     window.speechSynthesis.cancel();

//     widget.setState({
//       cursor: 0,
//       textIndex: 0,
//       time: 0,
//       texts: [],
//       playing: false,
//       paused: false,
//     });
//     widget.unlock();
//     widget.$external.events = [];
//   },
//   onPause(widget) {
//     widget.setState({ playing: false, paused: true });
//     widget.unlock();
//     window.speechSynthesis.pause();
//     clearInterval(widget.$external.interval);
//     widget.$external.interval = null;
//     clearTimeout(widget.$external.timeout);
//     widget.$external.timeout = null;
//     widget.$external.audio.pause();
//   },
//   createSpeech(widget) {
//     const speech = new SpeechSynthesisUtterance();
//     speech.lang = document.querySelector('html')?.getAttribute('lang') ?? 'en';
//     speech.pitch = 1;
//     speech.rate = 1;
//     speech.voice = widget.$external.voice;
//     // clearInterval(widget.$external.interval);

//     // widget.$external.interval = setInterval(() => {
//     //   if (window.speechSynthesis.speaking && !widget.state.playing) {
//     //     widget.$external.events.push(
//     //       'bug hunty',
//     //       window.speechSynthesis.speaking
//     //     );
//     //   }
//     // }, 1000);

//     speech.addEventListener('end', () => {
//       if (widget.state.textIndex + 1 < widget.state.texts.length) {
//         widget.$external.events.push('end next ' + widget.state.textIndex);
//         widget.onNext();
//       } else {
//         widget.$external.events.push('end cancel ' + widget.state.textIndex);
//         widget.onCancel();
//       }
//     });

//     speech.addEventListener('start', () => {
//       widget.$external.events.push('start ' + widget.state.textIndex);
//       clearTimeout(widget.$external.timeout);
//       widget.$external.timeout = null;
//       //widget.setState({ playing: true, paused: false });
//       //widget.lock();
//     });
//     speech.addEventListener('resume', () => {
//       widget.$external.events.push('resume ' + widget.state.textIndex);
//       //widget.setState({ playing: true, paused: false });
//       //widget.lock();
//     });
//     speech.addEventListener('pause', () => {
//       widget.$external.events.push('pause ' + widget.state.textIndex);
//       //widget.setState({ playing: false, paused: true });
//       //widget.unlock();
//     });
//     speech.addEventListener('error', (error) => {
//       widget.$external.events.push('error', error?.error);
//       if (error?.error !== 'interrupted') {
//         widget.setState({ playing: false, paused: false, error });
//       }
//       console.error(error);
//       //widget.unlock();
//     });
//     speech.addEventListener('boundary', (data) => {
//       //widget.$external.events.push('boundary');
//       widget.setState({ cursor: data.charIndex + data.charLength });
//     });

//     return speech;
//   },
//   async lock(widget) {
//     if ('wakeLock' in navigator && !widget.$external.wakeLock) {
//       widget.$external.wakeLock = await navigator.wakeLock.request('screen');
//     }
//   },
//   async unlock(widget) {
//     await widget.$external.wakeLock?.release();
//     widget.$external.wakeLock = null;
//   },
//   getTimeRemaining(widget) {
//     const { texts, textIndex, cursor } = widget.state;
//     if (!texts[textIndex]) {
//       return 0;
//     }

//     let { right: remaining } = sliceByCursor(texts[textIndex], cursor);

//     for (let i = textIndex + 1; i < texts.length; i++) {
//       remaining += texts[i];
//     }

//     if (remaining === '') {
//       return 0;
//     }

//     return widget.getReadingTime(remaining);
//   },
//   getReadingTime(widget, text) {
//     if (!text) {
//       return 0;
//     }

//     const words = text.match(/\b/g).length / 2;
//     return (words / (180 / 60)) * 1000;
//   },
//   transform(widget, speech, text) {
//     if (speech.lang === 'cs' || speech.lang === 'cz') {
//       return CZ_DICTIONARY.reduce((result, [pattern, replacement, flags]) => {
//         return result.replaceAll(
//           new RegExp(pattern, `${flags ? flags : ''}g`),
//           replacement
//         );
//       }, text);
//     }

//     return text;
//   },
//   async pickVoice(widget) {
//     const voices = await new Promise((resolve) => {
//       let voices = window.speechSynthesis.getVoices();
//       if (voices.length !== 0) {
//         resolve(voices);
//       } else {
//         window.speechSynthesis.addEventListener(
//           'voiceschanged',
//           () => {
//             voices = window.speechSynthesis.getVoices();
//             resolve(voices);
//           },
//           { once: true }
//         );
//       }
//     });

//     widget.$external.voice =
//       voices.filter((voice) =>
//         new RegExp(widget.$external.lang, 'ig').test(voice.lang)
//       )[0] ?? voices[0];
//   },
//   createAudio(widget) {
//     const audio = document.createElement('audio');
//     audio.loop = true;

//     navigator.mediaSession.setActionHandler('play', function () {
//       widget.onPlay();
//     });

//     navigator.mediaSession.setActionHandler('pause', function () {
//       widget.onPause();
//     });

//     audio.addEventListener('play', function () {
//       navigator.mediaSession.playbackState = 'playing';
//     });

//     audio.addEventListener('pause', function () {
//       navigator.mediaSession.playbackState = 'paused';
//     });

//     widget.$external.audio = audio;
//   },
//   updateMetaData() {
//     navigator.mediaSession.metadata = new MediaMetadata({
//       title: document.title,
//       artist: 'speakable@robot',
//       album: '{domain}',
//       artwork: [
//         {
//           src: 'https://dummyimage.com/96x96',
//           sizes: '96x96',
//           type: 'image/png',
//         },
//         {
//           src: 'https://dummyimage.com/128x128',
//           sizes: '128x128',
//           type: 'image/png',
//         },
//         {
//           src: 'https://dummyimage.com/192x192',
//           sizes: '192x192',
//           type: 'image/png',
//         },
//         {
//           src: 'https://dummyimage.com/256x256',
//           sizes: '256x256',
//           type: 'image/png',
//         },
//         {
//           src: 'https://dummyimage.com/384x384',
//           sizes: '384x384',
//           type: 'image/png',
//         },
//         {
//           src: 'https://dummyimage.com/512x512',
//           sizes: '512x512',
//           type: 'image/png',
//         },
//       ],
//     });
//   },
//   updatePositionState(widget) {
//     if ('setPositionState' in navigator.mediaSession) {
//       const { audio } = widget.$external;
//       navigator.mediaSession.setPositionState({
//         duration: audio.duration,
//         playbackRate: audio.playbackRate,
//         position: audio.currentTime,
//       });
//     }
//   },
// };

// function createAudioSource(audio, duration) {
//   if (typeof MediaSource === 'undefined') {
//     audio.src = 'https://unpkg.com/@esmj/speakable@latest/dist/silence-6s.mp3';
//     return;
//   }

//   const mediaSource = new MediaSource();
//   audio.src = URL.createObjectURL(mediaSource);

//   mediaSource.addEventListener('sourceopen', () => {
//     const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

//     const frame = new Uint8Array([
//       0xff, 0xfb, 0x14, 0x64, 0xe1, 0x8f, 0xf0, 0x00, 0x00, 0x69, 0x00, 0x00,
//       0x00, 0x08, 0x00, 0x00, 0x0d, 0x20, 0x00, 0x00, 0x01, 0x00, 0x00, 0x01,
//       0xa4, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x34, 0x80, 0x00, 0x00, 0x04,
//       0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
//       0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
//       0x55, 0x55, 0x55, 0x55, 0x55, 0x4c, 0x41, 0x4d, 0x45, 0x33, 0x2e, 0x31,
//       0x30, 0x30, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
//       0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
//     ]);
//     const frames = Math.round((12 * 1) / 0.026);
//     const songBuffer = new Uint8Array(frames * frame.length);

//     for (let i = 0; i < frames; i++) {
//       songBuffer.set(frame, i * frame.length);
//     }

//     sourceBuffer.appendBuffer(songBuffer);

//     //sourceBuffer.appendBuffer(song.buffer);
//     // fetch('https://unpkg.com/@esmj/speakable@latest/dist/silence-6s.mp3')
//     //   .then(function (response) {
//     //     return response.arrayBuffer();
//     //   })
//     //   .then(function (arrayBuffer) {
//     //     sourceBuffer.addEventListener('updateend', function (e) {
//     //       if (!sourceBuffer.updating && mediaSource.readyState === 'open') {
//     //         mediaSource.endOfStream();
//     //       }
//     //     });
//     //     var enc = new TextDecoder('utf-8');
//     //     console.log(buf2hex(arrayBuffer));
//     //     console.log(buf2hex(song));
//     //     console.log(enc.decode(song));
//     //     console.log(enc.decode(arrayBuffer));
//     //     sourceBuffer.appendBuffer(arrayBuffer);
//     //   });
//   });
// }

// // function buf2hex(buffer) {
// //   // buffer is an ArrayBuffer
// //   return [...new Uint8Array(buffer)]
// //     .map((x) => x.toString(16).padStart(2, '0'))
// //     .join(' ');
// // }
