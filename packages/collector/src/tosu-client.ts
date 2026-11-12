import { createHash } from "crypto";
import { parseTosuMessage, type GameFrame } from "@osu-tracker/shared";

const DEFAULT_HOST = "127.0.0.1:24050";
const RECONNECT_DELAY_MS = 2000;

export type TosuClientOptions = {
  host?: string;
  onFrame: (frame: GameFrame) => void;
  onConnectionChange: (connected: boolean) => void;
  /** Called for each message tosu sends, whether it could be parsed or not. */
  onRawMessage?: (raw: string, receivedAt: number) => void;
};

/** The only place that knows how to reach tosu. Reconnects until stopped. */
export class TosuClient {
  private readonly host: string;
  private socket: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;
  private rejectedFrames = 0;

  constructor(private readonly options: TosuClientOptions) {
    this.host = options.host ?? DEFAULT_HOST;
  }

  get backgroundUrl(): string {
    return `http://${this.host}/files/beatmap/background`;
  }

  get rejectedFrameCount(): number {
    return this.rejectedFrames;
  }

  start(): void {
    this.stopped = false;
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.socket?.close();
  }

  /** The .osu file of the current map, or null if the current map is no longer this one. */
  async fetchBeatmapFile(checksum: string): Promise<string | null> {
    try {
      const response = await fetch(`http://${this.host}/files/beatmap/file`);
      if (!response.ok) return null;

      const bytes = Buffer.from(await response.arrayBuffer());
      const actual = createHash("md5").update(bytes).digest("hex");
      return actual === checksum ? bytes.toString("utf8") : null;
    } catch {
      return null;
    }
  }

  private connect(): void {
    const socket = new WebSocket(`ws://${this.host}/websocket/v2`);
    this.socket = socket;
    let connected = false;

    socket.addEventListener("open", () => {
      connected = true;
      this.options.onConnectionChange(true);
    });

    socket.addEventListener("message", (event) => {
      const raw = String(event.data);
      const receivedAt = Date.now();
      this.options.onRawMessage?.(raw, receivedAt);

      const frame = parseTosuMessage(raw, receivedAt);
      if (frame) this.options.onFrame(frame);
      else this.rejectedFrames += 1;
    });

    socket.addEventListener("close", () => {
      if (connected) this.options.onConnectionChange(false);
      if (!this.stopped)
        this.reconnectTimer = setTimeout(
          () => this.connect(),
          RECONNECT_DELAY_MS,
        );
    });
  }
}
