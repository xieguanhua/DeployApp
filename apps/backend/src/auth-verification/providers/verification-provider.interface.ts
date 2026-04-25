import type { VerificationChannel } from '../types';

export type VerificationMessage = {
  target: string;
  code: string;
  lang?: string;
};

export interface VerificationProvider {
  readonly channel: VerificationChannel;
  send(message: VerificationMessage): Promise<void>;
}
