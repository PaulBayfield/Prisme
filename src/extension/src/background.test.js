/**
 * Tests for background.js.
 *
 * background.js talks to `webextension-polyfill`'s `browser` global, which
 * only exists inside a real extension host. We mock that module, load
 * background.js fresh in each test (jest.resetModules), capture the
 * listener callbacks it registers on the mock, and invoke them directly
 * with canned `details`/`port` objects to assert on what gets persisted
 * to storage and forwarded to the popup port.
 */

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function encodeRaw(str) {
    // Mimics the shape of `details.requestBody.raw`: an array of chunks,
    // each carrying a `bytes` array-like of the chunk's UTF-8 bytes.
    const bytes = Array.from(new TextEncoder().encode(str));
    return [{ bytes }];
}

let mockBrowser;

function installMockBrowser() {
    mockBrowser = {
        runtime: {
            onConnect: { addListener: jest.fn() },
        },
        webRequest: {
            onBeforeRequest: { addListener: jest.fn() },
        },
        storage: {
            local: {
                set: jest.fn().mockResolvedValue(undefined),
            },
        },
    };
    jest.doMock("webextension-polyfill", () => mockBrowser);
    return mockBrowser;
}

function loadBackground() {
    require("./background.js");
    return mockBrowser;
}

function getRequestListener(browser) {
    return browser.webRequest.onBeforeRequest.addListener.mock.calls[0][0];
}

function getConnectListener(browser) {
    return browser.runtime.onConnect.addListener.mock.calls[0][0];
}

beforeEach(() => {
    jest.resetModules();
    installMockBrowser();
});

describe("listener registration", () => {
    test("registers onBeforeRequest for the LCL host with requestBody info", () => {
        const browser = loadBackground();

        expect(browser.webRequest.onBeforeRequest.addListener).toHaveBeenCalledTimes(1);
        const [, filter, extraInfoSpec] = browser.webRequest.onBeforeRequest.addListener.mock.calls[0];
        expect(filter).toEqual({ urls: ["https://monespace.lcl.fr/*"] });
        expect(extraInfoSpec).toEqual(["requestBody"]);
    });

    test("registers an onConnect listener", () => {
        const browser = loadBackground();
        expect(browser.runtime.onConnect.addListener).toHaveBeenCalledTimes(1);
    });
});

describe("login request capture", () => {
    test("parses a JSON login body and stores it under latestLoginData", async () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);
        const payload = { identifier: "user123", keypad: ["1", "2", "3"], sessionId: "sess-abc" };

        const result = listener({
            url: "https://monespace.lcl.fr/api/login",
            requestBody: { raw: encodeRaw(JSON.stringify(payload)) },
        });

        expect(result).toEqual({ cancel: false });
        expect(browser.storage.local.set).toHaveBeenCalledWith({ latestLoginData: payload });
    });

    test("reassembles a body split across multiple raw chunks", async () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);
        const payload = { identifier: "multi-chunk" };
        const json = JSON.stringify(payload);
        const mid = Math.floor(json.length / 2);
        const raw = [...encodeRaw(json.slice(0, mid)), ...encodeRaw(json.slice(mid))];

        listener({
            url: "https://monespace.lcl.fr/api/login",
            requestBody: { raw },
        });

        expect(browser.storage.local.set).toHaveBeenCalledWith({ latestLoginData: payload });
    });

    test("falls back to the raw string when the body isn't valid JSON", () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);

        listener({
            url: "https://monespace.lcl.fr/api/login",
            requestBody: { raw: encodeRaw("not-json-at-all") },
        });

        expect(browser.storage.local.set).toHaveBeenCalledWith({ latestLoginData: "not-json-at-all" });
    });

    test("does nothing when the login request has no requestBody.raw", () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);

        const result = listener({
            url: "https://monespace.lcl.fr/api/login",
            requestBody: {},
        });

        expect(result).toEqual({ cancel: false });
        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });

    test("never cancels the underlying request", () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);

        const result = listener({
            url: "https://monespace.lcl.fr/api/something-else",
            requestBody: {},
        });

        expect(result).toEqual({ cancel: false });
    });
});

describe("accounts request capture", () => {
    test("extracts query params and stores them under latestAccountData", () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);

        listener({
            url: "https://monespace.lcl.fr/api/user/accounts?contract_id=CT-1&foo=bar",
            requestBody: {},
        });

        expect(browser.storage.local.set).toHaveBeenCalledWith({
            latestAccountData: { contract_id: "CT-1", foo: "bar" },
        });
    });

    test("matches any URL that starts with the accounts path", () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);

        listener({
            url: "https://monespace.lcl.fr/api/user/accounts/12345?contract_id=CT-2",
            requestBody: {},
        });

        expect(browser.storage.local.set).toHaveBeenCalledWith({
            latestAccountData: { contract_id: "CT-2" },
        });
    });

    test("ignores unrelated URLs entirely", () => {
        const browser = loadBackground();
        const listener = getRequestListener(browser);

        const result = listener({
            url: "https://monespace.lcl.fr/api/some/other/endpoint",
            requestBody: {},
        });

        expect(result).toEqual({ cancel: false });
        expect(browser.storage.local.set).not.toHaveBeenCalled();
    });
});

describe("popup port forwarding", () => {
    test("forwards captured login data to a connected popup port", async () => {
        const browser = loadBackground();
        const connectListener = getConnectListener(browser);
        const requestListener = getRequestListener(browser);

        const port = { name: "popup", postMessage: jest.fn(), onDisconnect: { addListener: jest.fn() } };
        connectListener(port);

        const payload = { identifier: "user1" };
        requestListener({
            url: "https://monespace.lcl.fr/api/login",
            requestBody: { raw: encodeRaw(JSON.stringify(payload)) },
        });
        await flushPromises();

        expect(port.postMessage).toHaveBeenCalledWith({ type: "latestLoginData", data: payload });
    });

    test("ignores ports that aren't named 'popup'", async () => {
        const browser = loadBackground();
        const connectListener = getConnectListener(browser);
        const requestListener = getRequestListener(browser);

        const port = { name: "something-else", postMessage: jest.fn(), onDisconnect: { addListener: jest.fn() } };
        connectListener(port);

        requestListener({
            url: "https://monespace.lcl.fr/api/user/accounts?contract_id=CT-1",
            requestBody: {},
        });
        await flushPromises();

        expect(port.postMessage).not.toHaveBeenCalled();
    });

    test("stops forwarding once the popup port disconnects", async () => {
        const browser = loadBackground();
        const connectListener = getConnectListener(browser);
        const requestListener = getRequestListener(browser);

        const port = { name: "popup", postMessage: jest.fn(), onDisconnect: { addListener: jest.fn() } };
        connectListener(port);
        // Simulate the port disconnecting.
        const disconnectHandler = port.onDisconnect.addListener.mock.calls[0][0];
        disconnectHandler();

        requestListener({
            url: "https://monespace.lcl.fr/api/user/accounts?contract_id=CT-1",
            requestBody: {},
        });
        await flushPromises();

        expect(port.postMessage).not.toHaveBeenCalled();
        // Storage should still be updated even without a connected popup.
        expect(browser.storage.local.set).toHaveBeenCalledWith({
            latestAccountData: { contract_id: "CT-1" },
        });
    });

    test("does not forward when no popup port is connected", async () => {
        const browser = loadBackground();
        const requestListener = getRequestListener(browser);

        requestListener({
            url: "https://monespace.lcl.fr/api/user/accounts?contract_id=CT-1",
            requestBody: {},
        });
        await flushPromises();

        expect(browser.storage.local.set).toHaveBeenCalledWith({
            latestAccountData: { contract_id: "CT-1" },
        });
    });
});
