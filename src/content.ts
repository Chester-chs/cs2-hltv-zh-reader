import browser from 'webextension-polyfill';

browser.runtime.getManifest();

console.log(`[cs2-hltv-zh] content script injected at ${location.href}`);
