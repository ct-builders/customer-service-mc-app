/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import {
  exitCsrUrl,
  launchSignature,
  launchUrlForToken,
  storefrontBaseFor,
} from './csr-launch';
import {
  canEmbed,
  mergeSettings,
  DEFAULT_TOKEN_TTL_SECONDS,
  MAX_TOKEN_TTL_SECONDS,
  MIN_TOKEN_TTL_SECONDS,
  type TBuildDefaults,
} from './hooks/use-csr-settings';

const defaults: TBuildDefaults = {
  storefrontB2cUrl: 'https://shop.example.com',
  storefrontB2bUrl: 'https://portal.example.com',
  frameSrcOrigins: ['https://shop.example.com'],
};

describe('launchUrlForToken', () => {
  it('appends the redemption path and encodes the token', () => {
    expect(launchUrlForToken('https://shop.example.com', 'abc-123')).toBe(
      'https://shop.example.com/api/auth/impersonate?token=abc-123'
    );
  });

  it('does not double the slash when the base has a trailing one', () => {
    expect(launchUrlForToken('https://shop.example.com/', 't')).toBe(
      'https://shop.example.com/api/auth/impersonate?token=t'
    );
  });

  it('percent-encodes a token that is not URL-safe', () => {
    expect(launchUrlForToken('https://s.example.com', 'a+b/c=')).toContain(
      'token=a%2Bb%2Fc%3D'
    );
  });

  it('builds the exit URL', () => {
    expect(exitCsrUrl('https://shop.example.com/')).toBe(
      'https://shop.example.com/api/auth/impersonate?exit=1'
    );
  });
});

describe('storefrontBaseFor', () => {
  const settings = mergeSettings(defaults, undefined);

  it('sends B2C customers to the B2C storefront', () => {
    expect(storefrontBaseFor(settings, false)).toBe('https://shop.example.com');
  });

  it('sends B2B customers to the B2B storefront', () => {
    expect(storefrontBaseFor(settings, true)).toBe(
      'https://portal.example.com'
    );
  });
});

describe('mergeSettings', () => {
  it('falls back to the build defaults when nothing is stored', () => {
    expect(mergeSettings(defaults, undefined)).toEqual({
      storefrontB2cUrl: 'https://shop.example.com',
      storefrontB2bUrl: 'https://portal.example.com',
      launchMode: 'auto',
      tokenTtlSeconds: DEFAULT_TOKEN_TTL_SECONDS,
    });
  });

  it('lets a stored value override the build default', () => {
    expect(
      mergeSettings(defaults, { storefrontB2cUrl: 'https://other.example.com' })
        .storefrontB2cUrl
    ).toBe('https://other.example.com');
  });

  it('honours a stored empty string, so a storefront can be unset at runtime', () => {
    expect(
      mergeSettings(defaults, { storefrontB2bUrl: '' }).storefrontB2bUrl
    ).toBe('');
  });

  it('clamps a TTL below the minimum and above the maximum', () => {
    expect(
      mergeSettings(defaults, { tokenTtlSeconds: 1 }).tokenTtlSeconds
    ).toBe(MIN_TOKEN_TTL_SECONDS);
    expect(
      mergeSettings(defaults, { tokenTtlSeconds: 99999 }).tokenTtlSeconds
    ).toBe(MAX_TOKEN_TTL_SECONDS);
  });

  it('falls back to the default TTL for a non-numeric stored value', () => {
    expect(
      mergeSettings(defaults, { tokenTtlSeconds: 'soon' as unknown as number })
        .tokenTtlSeconds
    ).toBe(DEFAULT_TOKEN_TTL_SECONDS);
  });

  it('rejects an unknown launch mode rather than trusting stored data', () => {
    expect(
      mergeSettings(defaults, { launchMode: 'sideways' as never }).launchMode
    ).toBe('auto');
  });
});

describe('canEmbed', () => {
  it('allows an origin present in the compiled frame-src list', () => {
    expect(canEmbed('https://shop.example.com', defaults.frameSrcOrigins)).toBe(
      true
    );
  });

  it('ignores the path when comparing origins', () => {
    expect(
      canEmbed('https://shop.example.com/en-us', defaults.frameSrcOrigins)
    ).toBe(true);
  });

  it('refuses an origin that was not compiled in', () => {
    expect(
      canEmbed('https://portal.example.com', defaults.frameSrcOrigins)
    ).toBe(false);
  });

  it('treats a different scheme or port as a different origin', () => {
    expect(canEmbed('http://shop.example.com', defaults.frameSrcOrigins)).toBe(
      false
    );
    expect(
      canEmbed('https://shop.example.com:8443', defaults.frameSrcOrigins)
    ).toBe(false);
  });

  it('is false for an empty or unparseable URL', () => {
    expect(canEmbed('', defaults.frameSrcOrigins)).toBe(false);
    expect(canEmbed('not a url', defaults.frameSrcOrigins)).toBe(false);
  });

  it('is false when the build compiled no frame-src origins at all', () => {
    expect(canEmbed('https://shop.example.com', [])).toBe(false);
  });

  it('honours a wildcard allowlist entry', () => {
    expect(canEmbed('https://anything.example.com', ['*'])).toBe(true);
  });
});

describe('launchSignature', () => {
  const base = { customerId: 'c1' };

  it('is stable across calls with the same target', () => {
    expect(launchSignature({ ...base })).toBe(launchSignature({ ...base }));
  });

  it('ignores agent identity, which cannot change within a session', () => {
    expect(
      launchSignature({ ...base, agentEmail: 'a@example.com', agentName: 'A' })
    ).toBe(
      launchSignature({ ...base, agentEmail: 'b@example.com', agentName: 'B' })
    );
  });

  it('distinguishes customers', () => {
    expect(launchSignature({ customerId: 'c1' })).not.toBe(
      launchSignature({ customerId: 'c2' })
    );
  });

  it('distinguishes B2B from B2C for the same customer', () => {
    expect(launchSignature({ ...base, isB2B: true })).not.toBe(
      launchSignature({ ...base, isB2B: false })
    );
  });

  it('distinguishes business units', () => {
    expect(
      launchSignature({ ...base, isB2B: true, businessUnitKey: 'north' })
    ).not.toBe(
      launchSignature({ ...base, isB2B: true, businessUnitKey: 'south' })
    );
  });
});
