// Ticks made without signal, kept on the phone (localStorage) until they reach the server.
// One entry per item: the latest tap wins. Storage can be unavailable (private mode),
// in which case the queue lives only in memory for this page.
// Evening prep and daily care keep separate queues, as they're sent to different RPCs.

export type QueuedTick = { checked: boolean; at: string };
type Queue = Record<string, QueuedTick>;

export type TickQueue = ReturnType<typeof tickQueue>;

const KEYS = { prep: "prep:tick-queue", care: "prep:care-tick-queue" } as const;
const memory: Record<string, Queue> = {};

function tickQueue(key: string) {
  function read(): Queue {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "{}") as Queue;
    } catch {
      return memory[key] ?? {};
    }
  }

  function write(queue: Queue) {
    memory[key] = queue;
    try {
      if (Object.keys(queue).length) localStorage.setItem(key, JSON.stringify(queue));
      else localStorage.removeItem(key);
    } catch {
      // memory only
    }
  }

  return {
    read,
    enqueue(itemId: string, tick: QueuedTick) {
      write({ ...read(), [itemId]: tick });
    },
    // Only drop it if it wasn't tapped again while sending.
    dequeue(itemId: string, sent: QueuedTick) {
      const queue = read();
      if (queue[itemId]?.at === sent.at) {
        delete queue[itemId];
        write(queue);
      }
    },
    clear() {
      write({});
    },
  };
}

export const prepQueue = tickQueue(KEYS.prep);
export const careQueue = tickQueue(KEYS.care);

// Evening prep (kept under the original names).
export const readQueue = prepQueue.read;
export const enqueueTick = prepQueue.enqueue;
export const dequeueTick = prepQueue.dequeue;

// Sign-out: forget every unsent tick.
export function clearQueue() {
  prepQueue.clear();
  careQueue.clear();
}

// supabase-js reports a failed fetch (no signal) as an error without a Postgres code.
export function isNetworkError(error: { code?: string } | null) {
  return !!error && !error.code;
}
