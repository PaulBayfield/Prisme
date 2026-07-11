/**
 * Tests for popup.js.
 *
 * popup.js talks to the `webextension-polyfill` `browser` global (mocked,
 * same as background.test.js), but its encrypt/export logic uses real
 * `lz-string` and `crypto-js` — those are left unmocked so the test acts
 * as a round-trip check of the actual wire format the worker's
 * `script/decrypt.py` (and the frontend credential-exchange flow) must
 * be able to reverse.
 */

import LZString from "lz-string";
import CryptoJS from "crypto-js";

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function decryptPayload(encrypted, passphrase) {
    const compressed = CryptoJS.AES.decrypt(encrypted, passphrase).toString(CryptoJS.enc.Utf8);
    const json = LZString.decompressFromBase64(compressed);
    return JSON.parse(json);
}

let mockBrowser;

function installMockBrowser({ manifest = { version: "1.4.0" }, storageData = {} } = {}) {
    mockBrowser = {
        runtime: {
            getManifest: jest.fn().mockResolvedValue(manifest),
        },
        storage: {
            local: {
                get: jest.fn().mockResolvedValue(storageData),
            },
        },
    };
    jest.doMock("webextension-polyfill", () => mockBrowser);
    return mockBrowser;
}

function setupDom() {
    document.body.innerHTML = `
        <span id="version"></span>
        <input id="passphrase" />
        <button id="copyBtn"></button>
    `;
}

async function loadPopupAndFireLoad() {
    // Capture the "load" handler popup.js registers rather than dispatching
    // a real "load" event: jest-environment-jsdom keeps a single `window`
    // alive for the whole test file, so repeatedly dispatching "load" would
    // re-trigger every handler left over from earlier tests/requires. Since
    // jest.resetModules() gives us a fresh module (and thus a fresh
    // handler) each time, we grab that one handler and invoke it directly.
    const addEventListenerSpy = jest.spyOn(window, "addEventListener");
    require("./popup.js");
    const loadCall = addEventListenerSpy.mock.calls.find(([eventName]) => eventName === "load");
    addEventListenerSpy.mockRestore();

    await loadCall[1]();
    await flushPromises();
}

beforeEach(() => {
    jest.resetModules();
    setupDom();

    Object.defineProperty(window.navigator, "clipboard", {
        value: { writeText: jest.fn().mockResolvedValue(undefined) },
        configurable: true,
    });
    window.alert = jest.fn();
});

test("renders the extension version from the manifest", async () => {
    installMockBrowser({ manifest: { version: "9.9.9" } });
    await loadPopupAndFireLoad();

    expect(document.getElementById("version").textContent).toBe("9.9.9");
});

test("encrypts the stored login/account data and copies it to the clipboard", async () => {
    installMockBrowser({
        storageData: {
            latestLoginData: { identifier: "user123", keypad: ["1", "2"], sessionId: "sess-xyz" },
            latestAccountData: { contract_id: "CT-42" },
        },
    });
    await loadPopupAndFireLoad();

    document.getElementById("passphrase").value = "correct horse battery staple";
    document.getElementById("copyBtn").click();
    await flushPromises();

    expect(navigator.clipboard.writeText).toHaveBeenCalledTimes(1);
    const encrypted = navigator.clipboard.writeText.mock.calls[0][0];
    expect(typeof encrypted).toBe("string");

    const decrypted = decryptPayload(encrypted, "correct horse battery staple");
    expect(decrypted).toEqual({
        login: { identifier: "user123", keypad: ["1", "2"], sessionId: "sess-xyz" },
        account: { contract_id: "CT-42" },
    });

    expect(window.alert).toHaveBeenCalledWith("Data copied and encrypted! You can paste it in your app.");
});

test("produces a payload that cannot be decrypted with the wrong passphrase", async () => {
    installMockBrowser({
        storageData: {
            latestLoginData: { identifier: "user123", keypad: ["1"], sessionId: "sess-1" },
            latestAccountData: { contract_id: "CT-1" },
        },
    });
    await loadPopupAndFireLoad();

    document.getElementById("passphrase").value = "right-passphrase";
    document.getElementById("copyBtn").click();
    await flushPromises();

    const encrypted = navigator.clipboard.writeText.mock.calls[0][0];

    // Decrypting with the wrong passphrase yields garbage: depending on the
    // bytes involved that either throws while decoding/decompressing, or
    // silently produces something that isn't the original payload (e.g.
    // LZString.decompressFromBase64 returning null for malformed input).
    // Assert on the actual guarantee -- the wrong passphrase never recovers
    // the real data -- rather than a specific failure mode, since the
    // former would make this test flaky.
    let decrypted;
    let threw = false;
    try {
        decrypted = decryptPayload(encrypted, "wrong-passphrase");
    } catch {
        threw = true;
    }

    if (!threw) {
        expect(decrypted).not.toEqual({
            login: { identifier: "user123", keypad: ["1"], sessionId: "sess-1" },
            account: { contract_id: "CT-1" },
        });
    }
});

test("omits undefined fields when no login/account data has been captured yet", async () => {
    installMockBrowser({ storageData: {} });
    await loadPopupAndFireLoad();

    document.getElementById("passphrase").value = "some-passphrase";
    document.getElementById("copyBtn").click();
    await flushPromises();

    const encrypted = navigator.clipboard.writeText.mock.calls[0][0];
    const decrypted = decryptPayload(encrypted, "some-passphrase");

    expect(decrypted).toEqual({ login: {}, account: {} });
});

test("refuses to encrypt/copy when no passphrase is entered", async () => {
    installMockBrowser({
        storageData: {
            latestLoginData: { identifier: "user123" },
            latestAccountData: { contract_id: "CT-1" },
        },
    });
    await loadPopupAndFireLoad();

    document.getElementById("passphrase").value = "   ";
    document.getElementById("copyBtn").click();
    await flushPromises();

    expect(window.alert).toHaveBeenCalledWith("Collez d'abord la phrase secrète fournie par l'application.");
    expect(navigator.clipboard.writeText).not.toHaveBeenCalled();
});
