import type { ListeningEvidence } from "../../domain/listening/model";
import type {
  MusicSource,
  ProviderCapabilities,
} from "../../domain/providers/capabilities";

export interface MusicProvider {
  readonly id: MusicSource;
  readonly capabilities: ProviderCapabilities;
  getRecentItems(limit?: number): Promise<readonly ListeningEvidence[]>;
}
