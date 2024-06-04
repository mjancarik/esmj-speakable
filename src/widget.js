/* eslint-disable no-unused-vars */
import { defineWidget } from '@merkur/core';
import { registerCustomElement } from '@merkur/integration-custom-element';
import cssBundle from '@merkur/integration-custom-element/cssBundle';
import { componentPlugin, createViewFactory } from '@merkur/plugin-component';
import { errorPlugin } from '@merkur/plugin-error';
import { eventEmitterPlugin } from '@merkur/plugin-event-emitter';

import { Speakable } from './components/Speakable';
import { audioPlugin } from './plugins/audio';
import { lockPlugin } from './plugins/lock';
import { speechPlugin } from './plugins/speech';

import './style.css';
import { name, version } from '../package.json';

const widgetDefinition = defineWidget({
  name,
  version,
  viewFactory: createViewFactory((widget) => ({
    View: Speakable,
    slotFactories: [],
  })),
  $plugins: [
    componentPlugin,
    eventEmitterPlugin,
    lockPlugin,
    speechPlugin,
    audioPlugin,
    errorPlugin,
  ],
  assets: [
    {
      name: 'widget.css',
      type: 'inlineStyle',
      source: cssBundle,
    },
  ],
  async setup(widget) {
    widget.container.style = `position: fixed; z-index: 10000; bottom: 0px; right: 0px;`;
    widget.$external = {
      ...widget.$external,
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
});

registerCustomElement({ widgetDefinition });
export default widgetDefinition;
