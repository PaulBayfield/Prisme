// jsdom's test environment doesn't provide TextEncoder/TextDecoder globally,
// but background.js relies on them (and our tests build fake requestBody.raw
// chunks with them too), so polyfill from Node's `util` module.
const { TextEncoder, TextDecoder } = require("util");

if (typeof global.TextEncoder === "undefined") {
    global.TextEncoder = TextEncoder;
}
if (typeof global.TextDecoder === "undefined") {
    global.TextDecoder = TextDecoder;
}
