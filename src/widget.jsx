import { componentPlugin } from '@merkur/plugin-component';
import { eventEmitterPlugin } from '@merkur/plugin-event-emitter';

import { lockPlugin } from './plugins/lock';
import { speechPlugin } from './plugins/speech';
import { audioPlugin } from './plugins/audio';

import { render } from 'preact';
import { Speakable } from './components/Speakable';
import { version } from '../package.json';

export const widgetProperties = {
  name: '@merkur/speakable',
  version,
  $plugins: [
    eventEmitterPlugin,
    componentPlugin,
    lockPlugin,
    speechPlugin,
    audioPlugin,
  ],
  assets: [],
  async setup(widget) {
    const container = document.createElement('div');
    container.style = `position: fixed; z-index: 10000;`;
    widget.$external = {
      ...widget.$external,
      container,
      events: [],
      audio: null,
    };

    return widget;
  },
  load() {
    return {
      debug: false,
      open: false,
    };
  },
  mount(widget) {
    widget.root.appendChild(widget.$external.container);

    const { style } = widget.$external.container;
    style.setProperty('bottom', `0px`);
    style.setProperty('right', `0px`);

    this.update(widget);
  },
  unmount() {
    // TODO
  },
  update(widget) {
    render(<Speakable widget={widget} />, widget.$external.container);
  },
};
