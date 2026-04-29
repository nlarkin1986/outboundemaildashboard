export type BatchSelection = { runId: string; contactId: string };

export function nextContactId(contactIds: string[], currentId: string | undefined) {
  if (!contactIds.length) return undefined;
  const currentIndex = currentId ? contactIds.indexOf(currentId) : -1;
  if (currentIndex >= 0 && currentIndex < contactIds.length - 1) return contactIds[currentIndex + 1];
  return currentId ?? contactIds[0];
}

export function nextBatchSelection(selections: BatchSelection[], current: BatchSelection | undefined) {
  if (!selections.length) return undefined;
  if (!current) return selections[0];
  const currentIndex = selections.findIndex((selection) => selection.runId === current.runId && selection.contactId === current.contactId);
  if (currentIndex >= 0 && currentIndex < selections.length - 1) return selections[currentIndex + 1];
  return current;
}
