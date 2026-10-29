// Ticks made without signal, kept on the phone (localStorage) until they reach the server.
// One entry per item: the latest tap wins. Storage can be unavailable (private mode),
// in which case the queue lives only in memory for this page.

export type QueuedTick = { checked: boolean; at: string };
type Queue = Record<string, QueuedTick>;

const KEY = "prep:tick-queue";
let memory: Queue = {};

export function readQueue(): Queue {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Queue;
  } catch {
    return memory;
  }
}

function writeQueue(queue: Queue) {
  memory = queue;
  try {
    if (Object.keys(queue).length) localStorage.setItem(KEY, JSON.stringify(queue));
    else localStorage.removeItem(KEY);
  } catch {
    // memory only
  }
}

export function enqueueTick(itemId: string, tick: QueuedTick) {
  writeQueue({ ...readQueue(), [itemId]: tick });
}

export function dequeueTick(itemId: string, sent: QueuedTick) {
  const queue = readQueue();
  // Only drop it if it wasn't tapped again while sending.
  if (queue[itemId]?.at === sent.at) {
    delete queue[itemId];
    writeQueue(queue);
  }
}

export function clearQueue() {
  writeQueue({});
}

// supabase-js reports a failed fetch (no signal) as an error without a Postgres code.
export function isNetworkError(error: { code?: string } | null) {
  return !!error && !error.code;
}
