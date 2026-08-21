/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

declare module '@commercetools/sync-actions' {
  export type SyncAction = { action: string; [x: string]: unknown };
  function buildActions<NextDraft, OriginalDraft>(
    nextDraft: NextDraft,
    originalDraft: OriginalDraft
  ): SyncAction[];
  export type Syncer = {
    buildActions: typeof buildActions;
  };
  export function createSyncChannels(): Syncer;
}
