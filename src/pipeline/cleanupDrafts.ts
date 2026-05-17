export function cleanupDraft(draft: object): void {
  for (const [key, value] of Object.entries(draft)) {
    if (
      (Array.isArray(value) && !value.length) ||
      value === undefined ||
      value === null ||
      value === ""
    ) {
      Reflect.deleteProperty(draft, key);
    }
  }
}

// Delete empty values in provided draft arrays
export default function cleanupDrafts<T extends object[][]>(...draftArrs: T): T {
  for (let drafts of draftArrs) {
    for (let draft of drafts) {
      cleanupDraft(draft);
    }
  }

  return draftArrs;
}
