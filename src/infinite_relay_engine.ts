import fs from "fs";
import path from "path";

export interface RelayStatus {
  active: boolean;
  currentAgentId: string;
  shiftNumber: number;
  lastSwapAt: string;
  vaultBytes: number;
  maxVaultBytes: number;
}

export class LocalContextVault {
  private readonly vaultPath: string;
  public readonly maxBytes = 2 * 1024 * 1024 * 1024;

  constructor(baseDir: string = process.cwd()) {
    this.vaultPath = path.join(baseDir, "sovereign_context_vault.jsonl");
  }

  public getSizeBytes(): number {
    try {
      return fs.existsSync(this.vaultPath) ? fs.statSync(this.vaultPath).size : 0;
    } catch {
      return 0;
    }
  }

  public loadFullConsolidatedContext(): string {
    try {
      if (!fs.existsSync(this.vaultPath)) {
        return "Sovereign Context Vault initialized (0 bytes).";
      }
      const raw = fs.readFileSync(this.vaultPath, "utf-8");
      const lines = raw.trim().split("\n").slice(-20);
      return lines.join("\n");
    } catch {
      return "Sovereign Context Vault unavailable.";
    }
  }

  public appendEntry(entry: Record<string, unknown>): void {
    try {
      const line = JSON.stringify({ ...entry, ts: new Date().toISOString() }) + "\n";
      fs.appendFileSync(this.vaultPath, line, "utf-8");
    } catch {
      // Non-fatal in read-only environments
    }
  }
}

export class InfiniteRelayOrchestrator {
  public readonly vault: LocalContextVault;
  public lastHandshake: Record<string, unknown> | null = null;
  private active = false;
  private shiftNumber = 1;
  private currentAgentId = "panoramiks-shift-1";
  private lastSwapAt = new Date().toISOString();

  constructor() {
    this.vault = new LocalContextVault();
  }

  public start(): void {
    this.active = true;
    this.lastHandshake = {
      status: "ready",
      agent: this.currentAgentId,
      shift: this.shiftNumber,
      timestamp: this.lastSwapAt,
    };
  }

  public getStatus(): RelayStatus {
    return {
      active: this.active,
      currentAgentId: this.currentAgentId,
      shiftNumber: this.shiftNumber,
      lastSwapAt: this.lastSwapAt,
      vaultBytes: this.vault.getSizeBytes(),
      maxVaultBytes: this.vault.maxBytes,
    };
  }

  public async performBenchHandover(
    reason: string,
    orchestrationFile?: string,
    newContent?: string
  ): Promise<Record<string, unknown>> {
    this.shiftNumber += 1;
    const prevAgent = this.currentAgentId;
    this.currentAgentId = `panoramiks-shift-${this.shiftNumber}`;
    this.lastSwapAt = new Date().toISOString();

    if (orchestrationFile && typeof newContent === "string") {
      fs.writeFileSync(orchestrationFile, newContent, "utf-8");
    }

    const handshake = {
      ok: true,
      reason,
      fromAgent: prevAgent,
      toAgent: this.currentAgentId,
      shiftNumber: this.shiftNumber,
      timestamp: this.lastSwapAt,
    };
    this.lastHandshake = handshake;
    this.vault.appendEntry(handshake);
    return handshake;
  }
}
