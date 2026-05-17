export function cleanupDraft<T extends object>(draft: T): void {
  for (const [key, value] of Object.entries(draft)) {
    if (
      (Array.isArray(value) && !value.length) ||
      value === undefined ||
      value === null ||
      value === ""
    ) {
      delete draft[key as keyof T];
    }
  }
}

// Delete empty values in provided draft arrays
export default function cleanupDrafts(...draftArrs: object[][]): void {
  for (let drafts of draftArrs) {
    for (let draft of drafts) {
      cleanupDraft(draft);
    }
  }
}
