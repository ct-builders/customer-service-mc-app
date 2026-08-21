/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback } from 'react';
import type {
  CustomObject,
  CustomObjectPagedQueryResponse,
} from '@commercetools/platform-sdk';
import { useCtp } from './sdk/use-ctp';
import {
  canEmbed,
  useCsrSettings,
  type TCsrSettings,
} from './hooks/use-csr-settings';

/**
 * "Shop as customer" (CSR impersonation) launch.
 *
 * The storefront needs to be told which customer to log in as, and it needs a
 * reason to believe the instruction really came from an authorized Customer
 * Service agent. A Merchant Center Custom Application is a *static* bundle with
 * no server of its own, so it cannot hold a signing key — anything baked into it
 * is readable by anyone who can load the app.
 *
 * So the handshake is brokered through commercetools itself:
 *
 *   1. This app writes a single-use launch token as a Custom Object in the
 *      project, holding the customer id, business unit, agent identity and a
 *      short expiry.
 *   2. The launch URL carries only that opaque token —
 *      `GET /api/auth/impersonate?token=<token>`. No secret, nothing replayable.
 *   3. The storefront reads the Custom Object with its own commercetools
 *      credentials, checks the expiry, DELETES it (single use), and only then
 *      starts a session as that customer.
 *
 * The trust argument: this app talks to commercetools exclusively through the
 * Merchant Center API gateway, which authenticates as the signed-in MC user and
 * enforces that user's permissions. A token can therefore only exist if some
 * real MC user holding `manage_key_value_documents` on this project minted it.
 * That is the authorization signal — there is no shared secret to leak, tokens
 * expire in seconds, and a used token is gone.
 *
 * See `docs/CSR-STOREFRONT-INTEGRATION.md` for the storefront side of this
 * contract and a reference implementation.
 */
export const LAUNCH_TOKEN_CONTAINER = 'csr-launch-tokens';

/** Value shape of a launch-token Custom Object. The storefront reads this. */
export type TCsrLaunchTokenValue = {
  customerId: string;
  /** B2B only: which business unit the agent is acting within. */
  businessUnitKey?: string;
  /** Signed-in MC user, so the storefront can attribute the order it places. */
  agentEmail?: string;
  agentName?: string;
  issuedAt: string;
  /** ISO 8601. The storefront MUST reject a token past this instant. */
  expiresAt: string;
};

export type TCsrLaunchTarget = {
  customerId: string;
  isB2B?: boolean;
  businessUnitKey?: string;
  agentEmail?: string;
  agentName?: string;
};

/**
 * 32 bytes of CSPRNG entropy, base64url-encoded (43 chars).
 *
 * base64url's alphabet is a subset of the Custom Object key charset
 * (`[-_~.a-zA-Z0-9]`, max 256), so the token needs no further escaping and is
 * safe both as a URL path segment and as a query parameter.
 */
const mintToken = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  let binary = '';
  bytes.forEach((b) => {
    binary += String.fromCharCode(b);
  });
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
};

/** Which storefront a target belongs on, given the resolved settings. */
export const storefrontBaseFor = (
  settings: TCsrSettings,
  isB2B?: boolean
): string => (isB2B ? settings.storefrontB2bUrl : settings.storefrontB2cUrl);

export const launchUrlForToken = (base: string, token: string): string =>
  `${base.replace(/\/$/, '')}/api/auth/impersonate?token=${encodeURIComponent(
    token
  )}`;

/** Ends impersonation and clears the storefront session. */
export const exitCsrUrl = (base: string): string =>
  `${base.replace(/\/$/, '')}/api/auth/impersonate?exit=1`;

export class CsrLaunchError extends Error {}

/**
 * Stable identity for a launch target.
 *
 * Callers use this to mint at most once per target. Memoizing the settings is
 * what stops the mint effect from re-firing, but this makes the guarantee
 * independent of React identity: a future dependency regression costs a missed
 * re-mint, not an unbounded loop that fills the project with tokens.
 *
 * Only the fields that change WHERE the launch goes are included. Agent identity
 * is deliberately excluded — it is recorded on the token but cannot change
 * within a session, so including it would only add churn.
 */
export const launchSignature = (target: TCsrLaunchTarget): string =>
  [
    target.customerId,
    target.isB2B ? 'b2b' : 'b2c',
    target.businessUnitKey ?? '',
  ].join('|');

export const useCsrLaunch = () => {
  const { get, post, del } = useCtp();
  const { settings, buildDefaults, loading, error } = useCsrSettings();

  /**
   * Best-effort cleanup of tokens nobody redeemed (the agent closed the tab, the
   * storefront was down). Expired tokens are inert, but they would otherwise
   * accumulate in the project forever. Failures are ignored on purpose — this is
   * hygiene, not part of the launch path.
   */
  const sweepExpired = useCallback(async (): Promise<void> => {
    try {
      const page = await get<CustomObjectPagedQueryResponse>(
        `/custom-objects/${LAUNCH_TOKEN_CONTAINER}?limit=100&sort=lastModifiedAt asc`
      );
      const now = Date.now();
      const stale = (page.results ?? []).filter((o) => {
        const expiresAt = (o.value as TCsrLaunchTokenValue | undefined)
          ?.expiresAt;
        return !expiresAt || Date.parse(expiresAt) < now;
      });
      await Promise.all(
        stale.map((o) =>
          del(`/custom-objects/${LAUNCH_TOKEN_CONTAINER}/${o.key}`).catch(
            () => undefined
          )
        )
      );
    } catch {
      // ignored — sweeping is opportunistic
    }
  }, [get, del]);

  /**
   * Mint a single-use token and return the storefront URL that redeems it.
   *
   * Each call produces a *fresh* token because redemption consumes it: the
   * embedded iframe and a subsequent "open in new tab" each need their own.
   */
  const mintLaunchUrl = useCallback(
    async (target: TCsrLaunchTarget): Promise<string> => {
      const base = storefrontBaseFor(settings, target.isB2B);
      if (!base) {
        throw new CsrLaunchError(
          'No storefront is configured. Set one on the Settings screen, or supply STOREFRONT_B2C_URL / STOREFRONT_B2B_URL at build time.'
        );
      }
      if (!target.customerId) {
        throw new CsrLaunchError('No customer selected.');
      }

      const token = mintToken();
      const issuedAt = new Date();
      const value: TCsrLaunchTokenValue = {
        customerId: target.customerId,
        ...(target.isB2B && target.businessUnitKey
          ? { businessUnitKey: target.businessUnitKey }
          : {}),
        ...(target.agentEmail ? { agentEmail: target.agentEmail } : {}),
        ...(target.agentName ? { agentName: target.agentName } : {}),
        issuedAt: issuedAt.toISOString(),
        expiresAt: new Date(
          issuedAt.getTime() + settings.tokenTtlSeconds * 1000
        ).toISOString(),
      };

      await post<CustomObject>('/custom-objects', {
        container: LAUNCH_TOKEN_CONTAINER,
        key: token,
        value,
      });

      void sweepExpired();
      return launchUrlForToken(base, token);
    },
    [post, settings, sweepExpired]
  );

  /**
   * Whether this launch should be embedded, honouring the configured mode and
   * the hard limit that the CSP `frame-src` allowlist is fixed at build time.
   */
  const shouldEmbed = useCallback(
    (isB2B?: boolean): boolean => {
      if (settings.launchMode === 'new-tab') return false;
      const base = storefrontBaseFor(settings, isB2B);
      if (settings.launchMode === 'embedded') return Boolean(base);
      return canEmbed(base, buildDefaults.frameSrcOrigins);
    },
    [settings, buildDefaults.frameSrcOrigins]
  );

  return {
    mintLaunchUrl,
    shouldEmbed,
    settings,
    buildDefaults,
    loading,
    error,
  };
};

/**
 * In-app path to the full-bleed "place order" page (which does the minting and
 * renders the storefront). Pure string building — no token is created here, so
 * navigating to it is free and idempotent.
 */
export const shopPagePath = (
  appBase: string,
  opts: {
    customerId: string;
    label?: string;
    isB2B?: boolean;
    businessUnitKey?: string;
  }
): string => {
  const p = new URLSearchParams({ customerId: opts.customerId });
  if (opts.label) p.set('label', opts.label);
  if (opts.isB2B) p.set('b2b', '1');
  if (opts.isB2B && opts.businessUnitKey) p.set('bu', opts.businessUnitKey);
  return `${appBase}/shop?${p.toString()}`;
};
