import * as browser from 'webextension-polyfill';

var manifestData = browser.runtime.getManifest();

console.info("[LCL Creds Grabber] Launched LCL Creds Grabber!");
console.info(`[LCL Creds Grabber] Version : ${manifestData.version}`);
