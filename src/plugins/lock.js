import { EVENTS } from './speech';

export function lockPlugin() {
  return {
    setup(widget) {
      widget.$external.wakeLock = null;

      return {
        async lock(widget) {
          if ('wakeLock' in navigator && !widget.$external.wakeLock) {
            widget.$external.wakeLock = await navigator.wakeLock.request(
              'screen'
            );
          }
        },
        async unlock(widget) {
          await widget.$external.wakeLock?.release();
          widget.$external.wakeLock = null;
        },
        ...widget,
      };
    },
    create(widget) {
      widget.on(widget, EVENTS.PLAY, () => {
        widget.lock();
      });
      widget.on(widget, EVENTS.END, () => {
        widget.unlock();
      });
      widget.on(widget, EVENTS.ERROR, () => {
        widget.unlock();
      });
      widget.on(widget, EVENTS.PAUSE, () => {
        widget.unlock();
      });
      widget.on(widget, EVENTS.CANCEL, () => {
        widget.unlock();
      });

      return widget;
    },
  };
}
