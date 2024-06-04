import { COMMANDS, EVENTS } from './speech';

export function audioPlugin() {
  return {
    setup(widget) {
      widget.$external.audio = null;

      return {
        ...widget,
        ...audioAPI(),
      };
    },
    create(widget) {
      widget.createAudio(widget);

      widget.on(widget, EVENTS.PLAY, () => {
        try {
          widget.createAudioSource(widget);

          widget.$external.audio
            .play()
            .then(() => {
              widget.updateMetaData(widget);
            })
            .catch((e) => {
              widget.$external.events.push('audio play error ' + e.message);
            });
        } catch (e) {
          widget.$external.events.push('error play ' + e.message);
        }

        navigator.mediaSession.playbackState = 'playing';
      });
      widget.on(widget, EVENTS.RESUME, () => {
        widget.$external.audio.play();
      });
      widget.on(widget, EVENTS.END, () => {
        widget.$external.audio.pause();
      });
      widget.on(widget, EVENTS.PAUSE, () => {
        widget.$external.audio.pause();
      });
      widget.on(widget, EVENTS.CANCEL, () => {
        widget.$external.audio.pause();
      });

      return widget;
    },
  };
}

function audioAPI() {
  return {
    createAudio(widget) {
      const audio = document.createElement('audio');
      audio.loop = true;

      navigator.mediaSession.setActionHandler('play', function () {
        widget.emit(COMMANDS.PLAY);
      });

      navigator.mediaSession.setActionHandler('pause', function () {
        widget.emit(COMMANDS.PAUSE);
      });

      audio.addEventListener('play', function () {
        navigator.mediaSession.playbackState = 'playing';
      });

      audio.addEventListener('pause', function () {
        navigator.mediaSession.playbackState = 'paused';
      });

      widget.$external.audio = audio;
    },
    createAudioSource(widget) {
      if (typeof MediaSource === 'undefined') {
        widget.$external.audio.src =
          'https://unpkg.com/@esmj/speakable@latest/public/silence-6s.mp3';
        return;
      }

      const mediaSource = new MediaSource();
      widget.$external.audio.src = URL.createObjectURL(mediaSource);

      //TODO check async sourceopen mechanism
      mediaSource.addEventListener('sourceopen', () => {
        const sourceBuffer = mediaSource.addSourceBuffer('audio/mpeg');

        const frame = new Uint8Array([
          0xff, 0xfb, 0x14, 0x64, 0xe1, 0x8f, 0xf0, 0x00, 0x00, 0x69, 0x00,
          0x00, 0x00, 0x08, 0x00, 0x00, 0x0d, 0x20, 0x00, 0x00, 0x01, 0x00,
          0x00, 0x01, 0xa4, 0x00, 0x00, 0x00, 0x20, 0x00, 0x00, 0x34, 0x80,
          0x00, 0x00, 0x04, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
          0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
          0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x4c,
          0x41, 0x4d, 0x45, 0x33, 0x2e, 0x31, 0x30, 0x30, 0x55, 0x55, 0x55,
          0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
          0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55, 0x55,
        ]);
        const frames = Math.round((12 * 1) / 0.026);
        const songBuffer = new Uint8Array(frames * frame.length);

        for (let i = 0; i < frames; i++) {
          songBuffer.set(frame, i * frame.length);
        }

        sourceBuffer.appendBuffer(songBuffer);
      });
    },
    updateMetaData() {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: document.title,
        artist: 'speakable@robot',
        album: '{domain}',
        artwork: [
          {
            src: 'https://dummyimage.com/96x96',
            sizes: '96x96',
            type: 'image/png',
          },
          {
            src: 'https://dummyimage.com/128x128',
            sizes: '128x128',
            type: 'image/png',
          },
          {
            src: 'https://dummyimage.com/192x192',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'https://dummyimage.com/256x256',
            sizes: '256x256',
            type: 'image/png',
          },
          {
            src: 'https://dummyimage.com/384x384',
            sizes: '384x384',
            type: 'image/png',
          },
          {
            src: 'https://dummyimage.com/512x512',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      });
    },
  };
}
