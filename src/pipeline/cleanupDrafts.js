export function cleanupDraft(draft) {
  for (const [key, value] of Object.entries(draft)) {
    if (
      (Array.isArray(value) && !value.length) ||
      value === undefined ||
      value === null ||
      value === ""
    ) {
      delete draft[key];
    }
  }
}

// Delete empty values in provided draft arrays
export default function (...draftArrs) {
  for (let drafts of draftArrs) {
    for (let draft of drafts) {
      cleanupDraft(draft);
    }
  }
}
