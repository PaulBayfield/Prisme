import * as browser from "webextension-polyfill";
import LZString from "lz-string";
import CryptoJS from "crypto-js";

window.addEventListener("load", async () => {
    const manifest = await browser.runtime.getManifest();
    document.querySelector("#version").textContent = manifest.version;

    let { latestLoginData, latestAccountData } = await browser.storage.local.get([
        "latestLoginData",
        "latestAccountData",
    ]);

    function setField(id, value) {
        const el = document.getElementById(id);
        el.textContent = value || "---";
    }

    function setMaskedField(id, value) {
        setField(id, value ? value.slice(0, 6) + "******" : "---");
    }

    setMaskedField("identifier", latestLoginData?.identifier);
    setMaskedField("keypad", latestLoginData?.keypad);
    setMaskedField("sessionId", latestLoginData?.sessionId);
    setMaskedField("contractId", latestAccountData?.contract_id);

    const port = browser.runtime.connect({ name: "popup" });
    port.onMessage.addListener((msg) => {
        if (msg.type === "latestLoginData") {
            latestLoginData = msg.data;
            setMaskedField("identifier", latestLoginData.identifier);
            setMaskedField("keypad", latestLoginData.keypad);
            setMaskedField("sessionId", latestLoginData.sessionId);
        }
        if (msg.type === "latestAccountData") {
            latestAccountData = msg.data;
            setMaskedField("contractId", latestAccountData.contract_id);
        }
    });

    document.getElementById("copyBtn").addEventListener("click", () => {
        const dataToCopy = {
            login: {
                identifier: latestLoginData?.identifier,
                keypad: latestLoginData?.keypad,
                sessionId: latestLoginData?.sessionId,
            },
            account: {
                contract_id: latestAccountData?.contract_id,
            },
        };

        const compressed = LZString.compressToBase64(JSON.stringify(dataToCopy));

        // TODO: Query the user app instance for a temporary passphrase
        const passphrase = "your-secure-passphrase";
        const encrypted = CryptoJS.AES.encrypt(compressed, passphrase).toString();

        navigator.clipboard.writeText(encrypted).then(() => {
            alert("Data copied and encrypted! You can paste it in your app.");
        });
    });
});
