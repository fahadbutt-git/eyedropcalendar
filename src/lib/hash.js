// A short, stable fingerprint of a plan link (64-bit FNV-1a). It names the
// phone's stored check marks and calendar events for that exact plan, so two
// plans never share them. It is an identifier, not a security measure.
export function planId(text) {
  let a = 0x811c9dc5;
  let b = 0x01000193 ^ 0x5bd1e995;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    a = Math.imul(a ^ c, 0x01000193);
    b = Math.imul(b ^ c, 0x5bd1e995) ^ (b >>> 15);
  }
  return (a >>> 0).toString(36) + (b >>> 0).toString(36);
}
