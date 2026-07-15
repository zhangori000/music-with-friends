import type { ListeningEvidence } from "../../domain/listening/model";
import { mergeImportedHistory } from "../import/spotify-history";

const DATABASE_NAME = "music-with-friends";
const DATABASE_VERSION = 1;
const EVIDENCE_STORE = "imported-listening-evidence";

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () =>
      reject(request.error ?? new Error("IndexedDB request failed.")),
    );
  });
}

function transactionComplete(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.addEventListener("complete", () => resolve());
    transaction.addEventListener("abort", () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted.")),
    );
    transaction.addEventListener("error", () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed.")),
    );
  });
}

async function openHistoryDatabase(): Promise<IDBDatabase> {
  if (!("indexedDB" in globalThis)) {
    throw new Error("This browser does not support private local history storage.");
  }

  const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
  request.addEventListener("upgradeneeded", () => {
    const database = request.result;
    if (!database.objectStoreNames.contains(EVIDENCE_STORE)) {
      const store = database.createObjectStore(EVIDENCE_STORE, { keyPath: "id" });
      store.createIndex("playedAt", "playedAt");
    }
  });
  return requestResult(request);
}

export async function loadImportedHistory(): Promise<readonly ListeningEvidence[]> {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(EVIDENCE_STORE, "readonly");
    const completed = transactionComplete(transaction);
    const evidence = await requestResult(
      transaction.objectStore(EVIDENCE_STORE).getAll() as IDBRequest<
        ListeningEvidence[]
      >,
    );
    await completed;
    return evidence;
  } finally {
    database.close();
  }
}

export async function mergeImportedHistoryIntoStore(
  chunks: readonly (readonly ListeningEvidence[])[],
): Promise<{ evidence: readonly ListeningEvidence[]; duplicateCount: number }> {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(EVIDENCE_STORE, "readwrite");
    const completed = transactionComplete(transaction);
    const store = transaction.objectStore(EVIDENCE_STORE);
    const currentRequest = store.getAll() as IDBRequest<ListeningEvidence[]>;
    const mergeReady = new Promise<{
      evidence: readonly ListeningEvidence[];
      duplicateCount: number;
    }>((resolve, reject) => {
      currentRequest.addEventListener("success", () => {
        try {
          const result = mergeImportedHistory([currentRequest.result, ...chunks]);
          const incomingIds = new Set<string>();
          const retainedIds = new Set(result.evidence.map((item) => item.id));
          for (const chunk of chunks) {
            for (const item of chunk) incomingIds.add(item.id);
          }

          // Queue writes in the request callback so Safari cannot auto-close the
          // transaction between reading current state and persisting new rows.
          // A richer Extended record can supersede a legacy record with a
          // different ID, so remove current rows the merge intentionally dropped.
          for (const item of currentRequest.result) {
            if (!retainedIds.has(item.id)) store.delete(item.id);
          }
          for (const item of result.evidence) {
            if (incomingIds.has(item.id)) store.put(item);
          }
          resolve(result);
        } catch (cause: unknown) {
          transaction.abort();
          reject(cause);
        }
      });
      currentRequest.addEventListener("error", () =>
        reject(currentRequest.error ?? new Error("IndexedDB history merge failed.")),
      );
    });
    const [merged] = await Promise.all([mergeReady, completed]);
    return merged;
  } finally {
    database.close();
  }
}

export async function clearImportedHistory(): Promise<void> {
  const database = await openHistoryDatabase();
  try {
    const transaction = database.transaction(EVIDENCE_STORE, "readwrite");
    const completed = transactionComplete(transaction);
    transaction.objectStore(EVIDENCE_STORE).clear();
    await completed;
  } finally {
    database.close();
  }
}
