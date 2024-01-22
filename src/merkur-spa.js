import { getMerkur, createMerkurWidget } from '@merkur/core';
import { loadAssets } from '@merkur/integration';

export async function createSPAWidget(properties) {
  const widgetProperties = {
    root: document.body,
    ...properties,
    createWidget: createMerkurWidget,
  };

  getMerkur().register(widgetProperties);

  await afterDOMLoad();
  await loadAssets(widgetProperties.assets, widgetProperties.root);

  return await getMerkur().create(widgetProperties);
}

export function afterDOMLoad() {
  return new Promise((resolve) => {
    if (typeof document !== 'undefined') {
      if (document.readyState !== 'loading') {
        resolve();
      } else {
        window.addEventListener('DOMContentLoaded', () => {
          resolve();
        });
      }
    }
  });
}
