export const PAGE_BATCH_MAX_ITEMS = 20;
export const PAGE_BATCH_MAX_CHARACTERS = 6000;

export interface PageBatchLimits {
  maxItems: number;
  maxCharacters: number;
}

export function partitionPageRecords<T extends { original: string }>(
  records: readonly T[],
  limits: PageBatchLimits = {
    maxItems: PAGE_BATCH_MAX_ITEMS,
    maxCharacters: PAGE_BATCH_MAX_CHARACTERS
  }
): T[][] {
  const batches: T[][] = [];
  let batch: T[] = [];
  let characters = 0;
  for (const record of records) {
    if (batch.length > 0 && (batch.length >= limits.maxItems ||
      characters + record.original.length > limits.maxCharacters)) {
      batches.push(batch);
      batch = [];
      characters = 0;
    }
    batch.push(record);
    characters += record.original.length;
  }
  if (batch.length > 0) {
    batches.push(batch);
  }
  return batches;
}
