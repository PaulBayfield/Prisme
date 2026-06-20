import * as browser from 'webextension-polyfill';

console.info("[Extension] Background worker loaded");

let popupPort = null;

browser.runtime.onConnect.addListener((port) => {
    if (port.name === "popup") {
        popupPort = port;

        port.onDisconnect.addListener(() => {
            popupPort = null;
        });
    }
});

async function updateData(key, value) {
    await browser.storage.local.set({ [key]: value });

    if (popupPort) {
        popupPort.postMessage({
            type: key,
            data: value
        });
    }
}

browser.webRequest.onBeforeRequest.addListener(
    (details) => {
        if (details.url === "https://monespace.lcl.fr/api/login" &&
            details.requestBody?.raw) {

            const decoder = new TextDecoder("utf-8");
            let body = "";

            for (const el of details.requestBody.raw) {
                body += decoder.decode(new Uint8Array(el.bytes));
            }

            let parsed;
            try {
                parsed = JSON.parse(body);
            } catch {
                parsed = body;
            }

            updateData("latestLoginData", parsed);
        } else if (details.url.startsWith("https://monespace.lcl.fr/api/user/accounts")) {

            const url = new URL(details.url);
            const params = Object.fromEntries(url.searchParams.entries());

            updateData("latestAccountData", params);
        }

        return { cancel: false };
    },
    { urls: ["<all_urls>"] },
    ["requestBody"]
);
