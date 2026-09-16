import browser from 'webextension-polyfill';

const { version } = browser.runtime.getManifest();

console.log(`[cs2-hltv-zh] background started (version ${version})`);
