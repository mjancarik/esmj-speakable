/**
 * @type import('@merkur/cli').defineConfig
 */
export default function () {
  return {
    extends: ['@merkur/preact/cli', '@merkur/integration-custom-element/cli'],
  };
}
