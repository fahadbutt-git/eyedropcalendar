import { useEffect, useState } from "react";

// A QR code image for `text`, as [dataUrl, failure]. Medium error correction
// survives a creased or smudged page. A very long plan falls back to low
// correction, and if it still does not fit the failure is "long". If the QR
// library itself cannot load, the failure is "load".
export function useQrCode(text, enabled) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState("");
  useEffect(() => {
    let live = true;
    if (!enabled || !text) {
      setSrc("");
      setFailed("");
      return;
    }
    import("qrcode")
      .catch(() => Promise.reject(new Error("load")))
      .then((QR) =>
        QR.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: "M" })
          .catch(() => QR.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: "L" }))
          .catch(() => Promise.reject(new Error("long"))),
      )
      .then((url) => live && (setSrc(url), setFailed("")))
      .catch((e) => live && (setSrc(""), setFailed(e?.message === "load" ? "load" : "long")));
    return () => {
      live = false;
    };
  }, [text, enabled]);
  return [src, failed];
}
