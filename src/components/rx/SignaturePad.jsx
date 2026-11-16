import { useEffect, useRef, useState } from "react";

// The prescriber signs each prescription here, with a finger, stylus or mouse.
// The signature belongs to this one prescription, and the prescription page
// clears it when the drops or patient change. The prescriber may keep it on
// this computer (never sent anywhere) and use it again with one click.
// Drawn at twice the display size so the printed signature stays sharp.
const W = 960;
const H = 300;

export default function SignaturePad({ signature, setSignature, saved = "", saveSignature }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(!signature);
  useEffect(() => {
    if (!signature) setEditing(true);
  }, [signature]);

  useEffect(() => {
    if (!editing) return;
    const c = canvas.current;
    const ctx = c.getContext("2d");
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, [editing]);

  const point = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return [((e.clientX - r.left) * W) / r.width, ((e.clientY - r.top) * H) / r.height];
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture(e.pointerId);
    drawing.current = true;
    const ctx = canvas.current.getContext("2d");
    ctx.beginPath();
    ctx.moveTo(...point(e));
  };
  const move = (e) => {
    if (!drawing.current) return;
    const ctx = canvas.current.getContext("2d");
    ctx.lineTo(...point(e));
    ctx.stroke();
    setDirty(true);
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    canvas.current.getContext("2d").clearRect(0, 0, W, H);
    setDirty(false);
  };
  const [keep, setKeep] = useState(false);
  const save = () => {
    const image = canvas.current.toDataURL("image/png");
    setSignature(image);
    if (keep && saveSignature) saveSignature(image);
    setEditing(false);
  };
  const forget = saved && saveSignature && (
    <button className="btn sm ghost" onClick={() => saveSignature("")}>
      Forget saved signature
    </button>
  );

  if (!editing)
    return (
      <div className="sig-saved">
        <img src={signature} alt="Your signature on this prescription" />
        <div className="row">
          <button className="btn sm" onClick={() => setEditing(true)}>
            Sign again
          </button>
          <button className="btn sm danger" onClick={() => (setSignature(""), setEditing(true))}>
            Remove
          </button>
          {forget}
        </div>
      </div>
    );

  return (
    <div className="sig-pad">
      {saved && (
        <div className="row sig-use">
          <button className="btn sm primary" onClick={() => (setSignature(saved), setEditing(false))}>
            Use my saved signature
          </button>
          {forget}
        </div>
      )}
      <canvas
        ref={canvas}
        width={W}
        height={H}
        aria-label="Signature drawing area. Draw with a mouse, finger or stylus."
        role="img"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
      />
      <div className="row">
        <button className="btn sm" onClick={clear} disabled={!dirty}>
          Clear
        </button>
        <button className="btn sm primary" onClick={save} disabled={!dirty}>
          Sign prescription
        </button>
        {signature && (
          <button className="btn sm ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
      {saveSignature && (
        <label className="check sig-keep">
          <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} />
          Keep this signature on this computer for my next prescriptions
        </label>
      )}
    </div>
  );
}
