// analytics/src/bus.ts
export type BusMessage = {
  type: string
  payload?: any
  ts?: number
  id?: string
}

const CHANNEL_NAME = 'mfe-bus-v1'

function makeMsg(partial: Partial<BusMessage> & { type: string }): BusMessage {
  return { ts: Date.now(), id: Math.random().toString(36).slice(2, 9), ...partial }
}

export function createBus() {
  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    const bc = new BroadcastChannel(CHANNEL_NAME)
    return {
      postMessage(msg: Partial<BusMessage> & { type: string }) {
        try { bc.postMessage(makeMsg(msg)) } catch {}
      },
      addEventListener(_kind: 'message', cb: (ev: MessageEvent) => void) {
        bc.addEventListener('message', cb as any)
      },
      removeEventListener(_kind: 'message', cb: (ev: MessageEvent) => void) {
        bc.removeEventListener('message', cb as any)
      },
      close() {
        try { bc.close() } catch {}
      }
    } as const
  }

  // fallback using localStorage events (same-origin)
  return {
    postMessage(msg: Partial<BusMessage> & { type: string }) {
      try {
        const payload = JSON.stringify(makeMsg(msg))
        localStorage.setItem(CHANNEL_NAME, payload)
        localStorage.removeItem(CHANNEL_NAME)
      } catch {}
    },
    addEventListener(_kind: 'message', cb: (ev: MessageEvent) => void) {
      const handler = (e: StorageEvent) => {
        if (e.key !== CHANNEL_NAME || !e.newValue) return
        try {
          const data = JSON.parse(e.newValue)
          cb({ data } as MessageEvent)
        } catch {}
      }
      window.addEventListener('storage', handler)
      ;(cb as any).__mfe_handler = handler
    },
    removeEventListener(_kind: 'message', cb: (ev: MessageEvent) => void) {
      const handler = (cb as any).__mfe_handler
      if (handler) window.removeEventListener('storage', handler)
    },
    close() { /* noop for fallback */ }
  } as const
}
