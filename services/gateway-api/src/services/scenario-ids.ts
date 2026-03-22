import { v7 as uuidv7 } from 'uuid';

export function createReplayEntityId(): string {
  return uuidv7();
}

