import { Component } from "react";

// Any unexpected error shows a way back instead of a blank page.
export default class ErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (!this.state.failed) return this.props.children;
    if (this.props.patient)
      return (
        <main className="empty" id="main">
          <h1>Something went wrong</h1>
          <p>Your drop plan and check marks are safe on this phone. Tap below to open it again.</p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Open my drops again
          </button>
        </main>
      );
    const restart = () => {
      try {
        sessionStorage.clear();
      } catch {
        // Storage is off: nothing to clear.
      }
      window.location.reload();
    };
    return (
      <main className="empty" id="main">
        <h1>Something went wrong</h1>
        <p>Your formulary and prescriber details are safe. Enter the current patient again.</p>
        <button className="btn primary" onClick={restart}>
          Start again
        </button>
      </main>
    );
  }
}
