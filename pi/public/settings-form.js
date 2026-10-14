// Edits waiting for "Apply", shared by every view that shows settings.
// This top part has no DOM access so the tests can import it.

/** JSON with sorted object keys, so equal values compare equal whatever order the server used. */
export function canon(value) {
  if (Array.isArray(value)) return `[${value.map(canon).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${canon(value[k])}`)
      .join(",")}}`;
  }
  return String(JSON.stringify(value));
}

export function createPending() {
  const edits = new Map(); // key -> { value } | { reset: true }
  const subs = new Set();
  const emit = () => subs.forEach((fn) => fn());
  return {
    set(key, value, current) {
      if (canon(value) === canon(current)) edits.delete(key);
      else edits.set(key, { value });
      emit();
    },
    reset(key) {
      edits.set(key, { reset: true });
      emit();
    },
    undo(key) {
      edits.delete(key);
      emit();
    },
    has: (key) => edits.has(key),
    get: (key) => edits.get(key),
    get count() {
      return edits.size;
    },
    keys: () => [...edits.keys()],
    clear() {
      edits.clear();
      emit();
    },
    restartNeeded: (items) => [...edits.keys()].some((k) => items.find((i) => i.key === k)?.apply === "restart"),
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
    /** Send edits one by one. The first failure stops it; that edit and the rest stay pending. */
    async apply(send) {
      const done = [];
      for (const [key, edit] of [...edits]) {
        try {
          await send(edit.reset ? "DELETE" : "PUT", key, edit.value);
        } catch (err) {
          err.key = key;
          emit();
          throw err;
        }
        edits.delete(key);
        done.push(key);
      }
      emit();
      return done;
    },
  };
}

/** Rows to list. Custom rows have their own editors. A search ignores the Simple/Advanced choice. */
export function visibleItems(items, { advanced, query }) {
  const q = query.trim().toLowerCase();
  return items.filter((s) => {
    if (s.custom) return false;
    if (q) return `${s.label} ${s.help ?? ""}`.toLowerCase().includes(q);
    return advanced || !s.advanced;
  });
}
