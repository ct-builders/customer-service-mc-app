/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import { canEmbed } from '../../hooks/use-csr-settings';
import { launchSignature, useCsrLaunch } from '../../csr-launch';
import { useAppBase } from '../../sdk/use-app-base';
import { useCurrentUser } from '../../sdk/use-current-user';
import { getErrorMessage } from '../../utils';

/**
 * Full-bleed "place order for customer" page — the storefront given maximum
 * space: no status bar, no tabs, no gutters, just a thin toolbar. Rendered on
 * the `/shop` route, which routes.tsx special-cases to skip the app chrome.
 *
 * Target is passed via query params so the page is self-contained:
 * `/shop?customerId=<id>&label=<name>&b2b=1&bu=<key>`.
 *
 * Launch tokens are single-use, so every way of opening the storefront mints its
 * own: the iframe on mount, and each click of "Open in new tab".
 */
const ShopPage = () => {
  const { goBack, push } = useHistory();
  const appBase = useAppBase();
  const { mintLaunchUrl, shouldEmbed, settings, buildDefaults, loading } =
    useCsrLaunch();
  // The signed-in MC user is the associate; the storefront records them on the
  // order so the buyer can see afterwards who placed it for them.
  const agent = useCurrentUser();

  const params = new URLSearchParams(useLocation().search);
  const customerId = params.get('customerId') ?? '';
  const label = params.get('label') || 'customer';
  const isB2B = params.get('b2b') === '1';
  const bu = params.get('bu') || undefined;

  const [embedUrl, setEmbedUrl] = useState<string>();
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);
  /**
   * Embedding is not reliable, for a reason outside this app's control: the
   * storefront's session cookie is third-party inside the Merchant Center's
   * iframe, and browsers increasingly refuse those. When that happens the
   * handshake still succeeds — the token is redeemed — but the page that loads
   * next has no session, so the frame comes up blank or bounced.
   *
   * Rather than leave the agent staring at a white rectangle, surface the escape
   * hatch a few seconds in. Not an error: it may simply be a slow first load,
   * which is why the iframe stays mounted underneath.
   */
  const [showEmbedFallback, setShowEmbedFallback] = useState(false);

  const target = {
    customerId,
    isB2B,
    businessUnitKey: bu,
    agentEmail: agent.email,
    agentName: agent.name,
  };
  // Read the live target inside callbacks without making them re-fire on every
  // render (the object literal above is new each time).
  const targetRef = useRef(target);
  targetRef.current = target;

  const storefront = isB2B
    ? settings.storefrontB2bUrl
    : settings.storefrontB2cUrl;
  const embeddable = shouldEmbed(isB2B);
  // Distinguish "the operator chose new-tab" from "we would have embedded but
  // the CSP will not allow this origin" — only the latter needs explaining.
  const blockedByCsp =
    settings.launchMode !== 'new-tab' &&
    Boolean(storefront) &&
    !canEmbed(storefront, buildDefaults.frameSrcOrigins);

  const openInNewTab = useCallback(async () => {
    setBusy(true);
    setError(undefined);
    try {
      const url = await mintLaunchUrl(targetRef.current);
      window.open(url, '_blank', 'noopener,noreferrer');
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }, [mintLaunchUrl]);

  // Tokens already minted, by target signature. Minting has a side effect in
  // commercetools, so this effect must run exactly once per target — never once
  // per render.
  const mintedFor = useRef<string | undefined>(undefined);

  // Mint the embedded launch once the settings have loaded.
  useEffect(() => {
    if (loading || !customerId || !embeddable) return;
    const signature = launchSignature(targetRef.current);
    if (mintedFor.current === signature) return;
    mintedFor.current = signature;

    let active = true;
    setError(undefined);
    mintLaunchUrl(targetRef.current)
      .then((url) => {
        if (active) setEmbedUrl(url);
      })
      .catch((e) => {
        if (active) {
          setError(getErrorMessage(e));
          // Let a retry happen if the target is revisited after a failure.
          mintedFor.current = undefined;
        }
      });
    return () => {
      active = false;
    };
    // Keyed on the launch target rather than object identity; the signature
    // guard above is what actually enforces once-per-target.
  }, [loading, customerId, isB2B, bu, embeddable, mintLaunchUrl]);

  // Timer starts when the frame is handed a URL, not on mount, so a slow mint
  // does not eat the grace period.
  useEffect(() => {
    if (!embedUrl) return;
    setShowEmbedFallback(false);
    const t = setTimeout(() => setShowEmbedFallback(true), 6000);
    return () => clearTimeout(t);
  }, [embedUrl]);

  const notice = (() => {
    if (!customerId) return 'No customer selected.';
    if (!storefront)
      return 'No storefront is configured. Open Settings to point this app at one, or set STOREFRONT_B2C_URL / STOREFRONT_B2B_URL in the build environment.';
    if (error) return error;
    if (loading) return 'Loading settings…';
    return undefined;
  })();

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        flex: '1 1 auto',
        minHeight: 'calc(100vh - 56px)',
        background: '#fff',
      }}
    >
      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          padding: '6px 12px',
          borderBottom: '1px solid #e3e3e3',
          fontSize: 13,
          flex: '0 0 auto',
        }}
      >
        <button
          type="button"
          onClick={() => goBack()}
          style={{
            background: 'none',
            border: '1px solid #d4d4d8',
            borderRadius: 6,
            padding: '4px 10px',
            font: 'inherit',
            fontWeight: 600,
            cursor: 'pointer',
            color: '#4b5563',
          }}
        >
          ← Back
        </button>
        <span style={{ fontWeight: 600, color: '#1f2937' }}>
          Placing order as {label} — CSR mode
        </span>
        <span style={{ flex: 1 }} />
        {customerId && storefront && (
          <button
            type="button"
            onClick={openInNewTab}
            disabled={busy}
            style={{
              background: 'none',
              border: 'none',
              padding: '4px 2px',
              font: 'inherit',
              fontWeight: 600,
              color: '#3c41c9',
              cursor: busy ? 'progress' : 'pointer',
            }}
          >
            {busy ? 'Opening…' : 'Open in new tab ↗'}
          </button>
        )}
      </div>

      {notice ? (
        <div
          style={{
            padding: 24,
            display: 'grid',
            gap: 12,
            justifyItems: 'start',
          }}
        >
          <span>{notice}</span>
          {!storefront && (
            <button
              type="button"
              onClick={() => push(`${appBase}/settings`)}
              style={{
                border: '1px solid #d4d4d8',
                borderRadius: 6,
                background: '#fff',
                padding: '6px 12px',
                font: 'inherit',
                fontWeight: 600,
                cursor: 'pointer',
                color: '#3c41c9',
              }}
            >
              Open Settings
            </button>
          )}
        </div>
      ) : embeddable ? (
        embedUrl ? (
          <React.Fragment>
            {showEmbedFallback && (
              <div
                style={{
                  flex: '0 0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '8px 12px',
                  background: '#fffbeb',
                  borderBottom: '1px solid #fde68a',
                  fontSize: 13,
                  color: '#78350f',
                }}
              >
                <span style={{ flex: 1 }}>
                  Storefront not appearing? The Merchant Center embeds it in a
                  frame, and some browsers block the storefront&apos;s session
                  cookie there. Opening it in a new tab always works.
                </span>
                <button
                  type="button"
                  onClick={openInNewTab}
                  disabled={busy}
                  style={{
                    flex: '0 0 auto',
                    border: 'none',
                    borderRadius: 6,
                    background: '#3c41c9',
                    color: '#fff',
                    padding: '6px 12px',
                    font: 'inherit',
                    fontWeight: 600,
                    cursor: busy ? 'progress' : 'pointer',
                  }}
                >
                  {busy ? 'Opening…' : 'Open in new tab ↗'}
                </button>
              </div>
            )}
            <iframe
              src={embedUrl}
              title="Storefront — place order for customer"
              style={{
                flex: '1 1 auto',
                width: '100%',
                border: 'none',
                minHeight: 0,
              }}
            />
          </React.Fragment>
        ) : (
          <div style={{ padding: 24 }}>Opening the storefront…</div>
        )
      ) : (
        /* Not embeddable: either the operator chose new-tab, or this origin is
           outside the build-time frame-src allowlist and an iframe would render
           blank. Say which, and give them the working path. */
        <div
          style={{
            padding: 24,
            display: 'grid',
            gap: 12,
            justifyItems: 'start',
            maxWidth: 620,
          }}
        >
          <span style={{ fontWeight: 600, color: '#1f2937' }}>
            {blockedByCsp
              ? 'This storefront cannot be embedded in the Merchant Center.'
              : 'This app is set to open the storefront in a new tab.'}
          </span>
          {blockedByCsp && (
            <span style={{ color: '#4b5563', lineHeight: 1.5 }}>
              A Custom Application&apos;s Content-Security-Policy is compiled
              into its bundle, so <code>{new URL(storefront).origin}</code> has
              to be present at build time to be framed. Set{' '}
              <code>STOREFRONT_B2C_URL</code> / <code>STOREFRONT_B2B_URL</code>{' '}
              (or <code>CSR_EXTRA_FRAME_SRC</code>) to this origin and rebuild.
              Opening in a new tab works either way.
            </span>
          )}
          <button
            type="button"
            onClick={openInNewTab}
            disabled={busy}
            style={{
              border: 'none',
              borderRadius: 6,
              background: '#3c41c9',
              color: '#fff',
              padding: '8px 16px',
              font: 'inherit',
              fontWeight: 600,
              cursor: busy ? 'progress' : 'pointer',
            }}
          >
            {busy ? 'Opening…' : 'Open storefront ↗'}
          </button>
        </div>
      )}
    </div>
  );
};
ShopPage.displayName = 'ShopPage';

export default ShopPage;
