import { useEffect, useState } from "react";

const isStandalone = () => window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

// Offers "Add to home screen" in the browser. Hidden once installed.
export default function InstallTip() {
  const [prompt, setPrompt] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    const capture = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", capture);
    return () => window.removeEventListener("beforeinstallprompt", capture);
  }, []);
  if (isStandalone()) return null;

  const install = () => {
    if (!prompt) return setShowHelp(true);
    prompt.prompt();
    setPrompt(null);
  };
  return (
    <section className="card card-b stack" style={{ gap: 10 }}>
      <h2 className="pt-h2">Keep this on your phone</h2>
      <p>Add this page to your home screen to open it like an app, even without internet.</p>
      <button className="btn" onClick={install}>
        Add to home screen
      </button>
      {showHelp && (
        <p className="notice info small">
          {isIOS()
            ? "In Safari, tap the Share button (a square with an arrow), then Add to Home Screen."
            : "Open your browser menu (three dots), then tap Install app or Add to Home screen."}
        </p>
      )}
    </section>
  );
}
