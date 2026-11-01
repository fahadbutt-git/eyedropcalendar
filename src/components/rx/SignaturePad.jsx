import { useEffect, useRef, useState } from "react";

// Draw a signature once. It is saved as an image on this device only and is
// never sent anywhere. The prescriber applies it to each prescription.
const W = 480;
const H = 150;

export default function SignaturePad({ signature, setSignature }) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState(!signature);

  useEffect(() => {
    if (!editing) return;
    const c = canvas.current;
    const ctx = c.getContext("2d");
    ctx.lineWidth = 2.5;
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
  const save = () => {
    setSignature(canvas.current.toDataURL("image/png"));
    setEditing(false);
  };

  if (!editing)
    return (
      <div className="sig-saved">
        <img src={signature} alt="Your saved signature" />
        <div className="row">
          <button className="btn sm" onClick={() => setEditing(true)}>
            Redraw
          </button>
          <button className="btn sm danger" onClick={() => window.confirm("Delete your saved signature from this device?") && (setSignature(""), setEditing(true))}>
            Delete
          </button>
        </div>
      </div>
    );

  return (
    <div className="sig-pad">
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
          Save signature
        </button>
        {signature && (
          <button className="btn sm ghost" onClick={() => setEditing(false)}>
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
