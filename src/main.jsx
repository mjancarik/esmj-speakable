import { createSPAWidget } from './merkur-spa';

import { widgetProperties } from './widget';
class ESMJSpeakable extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: 'open' });

    (async () => {
      try {
        if (
          typeof __ESMJ_SPEAKABLE__ !== 'undefined' &&
          __ESMJ_SPEAKABLE__?.assets?.length
        ) {
          widgetProperties.assets.push(...__ESMJ_SPEAKABLE__.assets);
        }

        widgetProperties.root = import.meta.env.DEV ? document.body : shadow;
        const widget = await createSPAWidget(widgetProperties);
        widget.mount();
      } catch (error) {
        console.error(error);
      }
    })();
  }
}

if (customElements.get('esmj-speakable') === undefined) {
  customElements.define('esmj-speakable', ESMJSpeakable);
}

// (async () => {
//   const response = await fetch(
//     'https://unpkg.com/@esmj/speakable@latest/dist/index.umd.cjs'
//   );
//   const text = await response.text();

//   const element = document.createElement('esmj-speakable');
//   document.body.appendChild(element);

//   const script = document.createElement('script');
//   script.innerHTML = text;
//   document.head.appendChild(script);
// })();
