import { FORMULARY_VERSION, SEED_FORMULARY } from "../../data/formulary.js";
import { usePersistentState } from "../../hooks/usePersistentState.js";
import { cleanFormulary } from "../../lib/validate.js";

// An unedited formulary follows the latest defaults. An edited one is kept,
// and the Formulary page says when newer defaults exist.
export function useFormulary() {
  const [store, setStore] = usePersistentState(
    "edt.formulary.v3",
    { version: FORMULARY_VERSION, edited: false, list: SEED_FORMULARY },
    { check: (s) => (s?.edited ? { ...s, list: cleanFormulary(s.list) || SEED_FORMULARY } : s) }
  );
  const list = store.edited ? store.list : SEED_FORMULARY;
  const save = (next) => setStore({ version: store.version, edited: true, list: next });
  const restore = () => setStore({ version: FORMULARY_VERSION, edited: false, list: SEED_FORMULARY });
  return { list, save, restore, outdated: store.edited && store.version < FORMULARY_VERSION };
}
