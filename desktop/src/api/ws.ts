import { API_BASE } from "./client";
import type { WSEvent } from "./types";

export class ProjectSocket {
  private ws: WebSocket | null = null;
  private listeners = new Set<(e: WSEvent) => void>();
  private retry = 0;
  private closed = false;

  constructor(private projectId: number, private token: string) {
    this.open();
  }

  private url() {
    const base = API_BASE.replace(/^http/, "ws");
    return `${base}/ws/projects/${this.projectId}/?token=${encodeURIComponent(this.token)}`;
  }

  private open() {
    this.ws = new WebSocket(this.url());
    this.ws.onopen = () => {
      this.retry = 0;
    };
    this.ws.onmessage = (m) => {
      try {
        const data = JSON.parse(m.data) as WSEvent;
        this.listeners.forEach((cb) => cb(data));
      } catch {}
    };
    this.ws.onclose = () => {
      if (this.closed) return;
      const delay = Math.min(1000 * 2 ** this.retry++, 10_000);
      setTimeout(() => this.open(), delay);
    };
    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  on(cb: (e: WSEvent) => void) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  close() {
    this.closed = true;
    this.ws?.close();
  }
}
