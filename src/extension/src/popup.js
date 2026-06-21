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

        const passphrase = document.getElementById("passphrase").value.trim();
        if (!passphrase) {
            alert("Collez d'abord la phrase secrète fournie par l'application.");
            return;
        }

        const compressed = LZString.compressToBase64(JSON.stringify(dataToCopy));
        const encrypted = CryptoJS.AES.encrypt(compressed, passphrase).toString();

        navigator.clipboard.writeText(encrypted).then(() => {
            alert("Data copied and encrypted! You can paste it in your app.");
        });
    });
});
