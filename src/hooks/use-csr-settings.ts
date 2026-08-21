/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useCallback, useMemo } from 'react';
import { useApplicationContext } from '@commercetools-frontend/application-shell-connectors';
import type { CustomObject } from '@commercetools/platform-sdk';
import { useAsyncData } from '../sdk/use-async-data';
import { useCtp } from '../sdk/use-ctp';

/**
 * Runtime configuration for the "shop as customer" (CSR) launch.
 *
 * Stored as a Custom Object so the app can be pointed at a storefront without a
 * rebuild — the Settings screen writes it, and it overrides the build-time
 * defaults threaded through `additionalEnv`. A deployment that only ever uses
 * build env vars never creates this object and behaves exactly as before.
 */
export const SETTINGS_CONTAINER = 'csr-settings';
export const SETTINGS_KEY = 'storefront';

export const DEFAULT_TOKEN_TTL_SECONDS = 120;
export const MIN_TOKEN_TTL_SECONDS = 30;
export const MAX_TOKEN_TTL_SECONDS = 900;

/**
 * How the storefront is opened.
 *
 *  `embedded`  always render the storefront in the in-app iframe.
 *  `new-tab`   always open a new browser tab.
 *  `auto`      embed when the storefront's origin is in the build-time CSP
 *              `frame-src` allowlist, otherwise open a new tab. This is the
 *              default because a runtime-configured origin that was not present
 *              at build time *cannot* be framed — see `canEmbed` below.
 */
export type TLaunchMode = 'auto' | 'embedded' | 'new-tab';

export type TCsrSettings = {
  storefrontB2cUrl: string;
  storefrontB2bUrl: string;
  launchMode: TLaunchMode;
  /** Lifetime of a single-use launch token, in seconds. */
  tokenTtlSeconds: number;
};

export type TBuildDefaults = {
  storefrontB2cUrl: string;
  storefrontB2bUrl: string;
  /**
   * Origins baked into the Content-Security-Policy `frame-src` at build time.
   * A Custom Application is a static bundle: appkit compiles its CSP into
   * index.html, so this list cannot be changed from the running app.
   */
  frameSrcOrigins: ReadonlyArray<string>;
};

/**
 * Build-time wiring supplied by `additionalEnv` in custom-application-config.mjs.
 *
 * The selector returns `context.environment` itself — a stable reference — and
 * the derived object is memoized against it. Selecting a freshly-built object
 * instead would hand every caller a new identity on every render, which is not
 * cosmetic: `mintLaunchUrl` depends on these settings, `shop-page`'s mint effect
 * depends on `mintLaunchUrl`, and minting sets state. That chain turned one
 * launch into an unbounded mint loop — 84 tokens in under a minute — until the
 * identity was made stable here.
 */
export const useBuildDefaults = (): TBuildDefaults => {
  const environment = useApplicationContext(
    (context) => context.environment
  ) as {
    storefrontB2bUrl?: string;
    storefrontB2cUrl?: string;
    frameSrcOrigins?: ReadonlyArray<string>;
  };
  return useMemo(() => {
    const b2b = environment?.storefrontB2bUrl || '';
    return {
      storefrontB2bUrl: b2b,
      storefrontB2cUrl: environment?.storefrontB2cUrl || b2b,
      frameSrcOrigins: environment?.frameSrcOrigins ?? [],
    };
  }, [environment]);
};

const clampTtl = (n: unknown): number => {
  const v =
    typeof n === 'number' && Number.isFinite(n)
      ? Math.round(n)
      : DEFAULT_TOKEN_TTL_SECONDS;
  return Math.min(MAX_TOKEN_TTL_SECONDS, Math.max(MIN_TOKEN_TTL_SECONDS, v));
};

const LAUNCH_MODES: ReadonlyArray<TLaunchMode> = [
  'auto',
  'embedded',
  'new-tab',
];

/** Merge a stored Custom Object over the build-time defaults, coercing bad input. */
export const mergeSettings = (
  defaults: TBuildDefaults,
  stored: Partial<TCsrSettings> | undefined
): TCsrSettings => ({
  storefrontB2cUrl: (
    stored?.storefrontB2cUrl ?? defaults.storefrontB2cUrl
  ).trim(),
  storefrontB2bUrl: (
    stored?.storefrontB2bUrl ?? defaults.storefrontB2bUrl
  ).trim(),
  launchMode: LAUNCH_MODES.includes(stored?.launchMode as TLaunchMode)
    ? (stored?.launchMode as TLaunchMode)
    : 'auto',
  tokenTtlSeconds: clampTtl(stored?.tokenTtlSeconds),
});

/**
 * True when `url`'s origin is in the build-time `frame-src` allowlist, i.e. the
 * browser will actually let us embed it. An origin configured at runtime that
 * was not present at build time returns false — the launch has to open a new
 * tab instead, and the Settings screen says so rather than rendering a blank
 * iframe and a console CSP violation.
 */
export const canEmbed = (
  url: string,
  frameSrcOrigins: ReadonlyArray<string>
): boolean => {
  if (!url) return false;
  let origin: string;
  try {
    origin = new URL(url).origin;
  } catch {
    return false;
  }
  return frameSrcOrigins.some((allowed) => {
    if (allowed === "'self'" || allowed === '*') return true;
    try {
      return new URL(allowed).origin === origin;
    } catch {
      return allowed === origin;
    }
  });
};

export const useCsrSettings = () => {
  const { get } = useCtp();
  const buildDefaults = useBuildDefaults();
  const { data, loading, error, refetch } = useAsyncData<
    CustomObject | undefined
  >(
    () =>
      get<CustomObject>(
        `/custom-objects/${SETTINGS_CONTAINER}/${SETTINGS_KEY}`
      ).catch(
        // 404 is the normal case: nothing has been saved, so build defaults win.
        () => undefined
      ),
    []
  );
  const stored = data?.value as Partial<TCsrSettings> | undefined;
  // Memoized for the same reason as useBuildDefaults: a new object per render
  // propagates into mintLaunchUrl and re-fires the mint effect.
  const settings = useMemo(
    () => mergeSettings(buildDefaults, stored),
    [buildDefaults, stored]
  );
  return {
    settings,
    buildDefaults,
    /** True when a Settings screen save is overriding the build env vars. */
    isOverridden: Boolean(data),
    loading,
    error,
    refetch,
  };
};

export const useCsrSettingsActions = () => {
  const { post, del } = useCtp();

  const save = useCallback(
    (settings: TCsrSettings) =>
      post<CustomObject>('/custom-objects', {
        container: SETTINGS_CONTAINER,
        key: SETTINGS_KEY,
        value: {
          ...settings,
          tokenTtlSeconds: clampTtl(settings.tokenTtlSeconds),
        },
      }),
    [post]
  );

  /** Drop the override and fall back to the build-time env vars. */
  const reset = useCallback(
    () =>
      del<CustomObject>(
        `/custom-objects/${SETTINGS_CONTAINER}/${SETTINGS_KEY}`
      ),
    [del]
  );

  return { save, reset };
};
