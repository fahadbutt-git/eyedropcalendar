import { useEffect, useState } from "react";
import { usePersistentState } from "../../hooks/usePersistentState.js";
import { BLANK_PRESCRIBER, checkPrescriber, checkSavedSignature, prescriberFromOscar } from "./state.js";

const keyOf = (p) => `${(p.name || "").trim()}|${(p.license || "").trim()}`;

// The prescriber, saved on this computer, and the checks that keep a
// prescription from printing under someone else's name and licence.
//
// Saved details are confirmed once in each tab. Typing a new name or licence
// number is a choice made in this tab, so it counts as confirmed. Editing
// only the address or phone does not. Confirmation is held in memory only.
//
// A prescriber may also keep a signature on this computer. It is kept with
// their name and licence, offered only once they are confirmed, and placed on
// a prescription only with a click each time.
export function usePrescriber() {
  const [prescriber, setPrescriber] = usePersistentState("edt.prescriber.v1", BLANK_PRESCRIBER, { check: checkPrescriber });
  const [confirmedKey, setConfirmedKey] = useState("");
  const [savedSignature, setSavedSignature] = usePersistentState("edt.signature.saved.v2", null, { check: checkSavedSignature });
  const key = keyOf(prescriber);
  const confirmed = !!prescriber.name.trim() && confirmedKey === key;

  // Signatures saved by versions before the opt-in are removed.
  useEffect(() => {
    try {
      localStorage.removeItem("edt.signature.v1");
    } catch {
      // Storage is off: nothing was stored.
    }
  }, []);

  const edit = (next) => {
    if (keyOf(next) !== key) setConfirmedKey(keyOf(next));
    setPrescriber(next);
  };

  // The clinician signed in to Oscar fills in the prescriber. It is never
  // marked as confirmed, so the clinician still checks the details before a
  // prescription prints. The clinic name and fax stay as typed.
  const fillFromOscar = (clinician) => {
    const from = prescriberFromOscar(clinician);
    if (!from?.name) return;
    setPrescriber((p) => {
      const same = p.name.trim() === from.name && (!from.license || p.license.trim() === from.license);
      if (!same) return { ...p, ...from };
      return { ...p, ...Object.fromEntries(Object.entries(from).filter(([k, v]) => v && !p[k].trim())) };
    });
  };

  return {
    prescriber,
    edit,
    fillFromOscar,
    confirmed,
    confirm: () => setConfirmedKey(key),
    forgetConfirmation: () => setConfirmedKey(""),
    savedSignature: savedSignature?.key === key ? savedSignature.image : "",
    saveSignature: (image) => setSavedSignature(image ? { key, image } : null),
  };
}
