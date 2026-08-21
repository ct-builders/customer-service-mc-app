/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

import { useEffect, useState } from 'react';
import Card from '@commercetools-uikit/card';
import FieldLabel from '@commercetools-uikit/field-label';
import NumberInput from '@commercetools-uikit/number-input';
import PrimaryButton from '@commercetools-uikit/primary-button';
import SecondaryButton from '@commercetools-uikit/secondary-button';
import SelectInput from '@commercetools-uikit/select-input';
import Spacings from '@commercetools-uikit/spacings';
import Stamp from '@commercetools-uikit/stamp';
import Text from '@commercetools-uikit/text';
import TextInput from '@commercetools-uikit/text-input';
import {
  canEmbed,
  useCsrSettings,
  useCsrSettingsActions,
  DEFAULT_TOKEN_TTL_SECONDS,
  MAX_TOKEN_TTL_SECONDS,
  MIN_TOKEN_TTL_SECONDS,
  type TCsrSettings,
  type TLaunchMode,
} from '../../hooks/use-csr-settings';
import { getErrorMessage } from '../../utils';

/**
 * Settings for the "shop as customer" launch.
 *
 * Storefront wiring is runtime configuration (a Custom Object) rather than a
 * build variable, so this app can be pointed at a storefront without a rebuild.
 * Build-time env vars remain the default when nothing has been saved.
 *
 * The one thing that genuinely cannot be configured at runtime is the CSP
 * `frame-src` allowlist — appkit compiles it into the static bundle. This screen
 * therefore reports, per storefront, whether embedding will actually work, so a
 * misconfiguration shows up here rather than as a blank iframe.
 */

const LAUNCH_MODE_OPTIONS: Array<{ value: TLaunchMode; label: string }> = [
  { value: 'auto', label: 'Auto — embed when allowed, otherwise new tab' },
  { value: 'embedded', label: 'Always embed in the Merchant Center' },
  { value: 'new-tab', label: 'Always open a new browser tab' },
];

/** Empty is valid (that storefront is simply unconfigured); otherwise require an http(s) origin. */
const urlProblem = (value: string): string | undefined => {
  if (!value.trim()) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(value.trim());
  } catch {
    return 'Not a valid URL — include the scheme, e.g. https://shop.example.com';
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    return 'Must be an http(s) URL.';
  }
  if (parsed.pathname !== '/' && parsed.pathname !== '') {
    return 'Use the origin only, with no path — the launch path is appended automatically.';
  }
  return undefined;
};

const EmbedStatus = ({
  url,
  frameSrcOrigins,
}: {
  url: string;
  frameSrcOrigins: ReadonlyArray<string>;
}) => {
  if (!url.trim()) return null;
  if (urlProblem(url)) return null;
  return canEmbed(url, frameSrcOrigins) ? (
    <Stamp isCondensed tone="primary" label="Can be embedded" />
  ) : (
    <Stamp
      isCondensed
      tone="warning"
      label="New tab only — origin not in build-time CSP"
    />
  );
};

const Settings = () => {
  const { settings, buildDefaults, isOverridden, loading, refetch } =
    useCsrSettings();
  const { save, reset } = useCsrSettingsActions();

  const [draft, setDraft] = useState<TCsrSettings>(settings);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<{
    tone: 'ok' | 'error';
    message: string;
  }>();

  // Adopt the loaded settings once they arrive, without clobbering edits after.
  useEffect(() => {
    if (!loading) setDraft(settings);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, isOverridden]);

  const problems = [
    urlProblem(draft.storefrontB2cUrl),
    urlProblem(draft.storefrontB2bUrl),
  ].filter(Boolean) as string[];

  const run = async (action: () => Promise<unknown>, message: string) => {
    setBusy(true);
    setStatus(undefined);
    try {
      await action();
      refetch();
      setStatus({ tone: 'ok', message });
    } catch (e) {
      setStatus({ tone: 'error', message: getErrorMessage(e) });
    } finally {
      setBusy(false);
    }
  };

  const set = <K extends keyof TCsrSettings>(key: K, value: TCsrSettings[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  return (
    <Spacings.Stack scale="l">
      <Spacings.Stack scale="xs">
        <Text.Headline as="h1">Settings</Text.Headline>
        <Text.Detail tone="secondary">
          Where &ldquo;shop as customer&rdquo; sends a Customer Service agent,
          and how the launch is authorized.
        </Text.Detail>
      </Spacings.Stack>

      {loading ? (
        <Text.Body>Loading…</Text.Body>
      ) : (
        <Spacings.Stack scale="m">
          <Card theme="light" type="raised">
            <Spacings.Stack scale="m">
              <Spacings.Inline alignItems="center" scale="s">
                <Text.Subheadline as="h4">Storefronts</Text.Subheadline>
                <Stamp
                  isCondensed
                  tone={isOverridden ? 'information' : 'secondary'}
                  label={
                    isOverridden
                      ? 'Saved in this project'
                      : 'Using build defaults'
                  }
                />
              </Spacings.Inline>

              <Spacings.Stack scale="xs">
                <FieldLabel
                  title="B2C storefront URL"
                  hasRequiredIndicator={false}
                />
                <TextInput
                  value={draft.storefrontB2cUrl}
                  placeholder="https://shop.example.com"
                  onChange={(e) => set('storefrontB2cUrl', e.target.value)}
                />
                <Spacings.Inline scale="s" alignItems="center">
                  <EmbedStatus
                    url={draft.storefrontB2cUrl}
                    frameSrcOrigins={buildDefaults.frameSrcOrigins}
                  />
                  {urlProblem(draft.storefrontB2cUrl) && (
                    <Text.Detail tone="critical">
                      {urlProblem(draft.storefrontB2cUrl)}
                    </Text.Detail>
                  )}
                </Spacings.Inline>
              </Spacings.Stack>

              <Spacings.Stack scale="xs">
                <FieldLabel
                  title="B2B storefront URL"
                  hasRequiredIndicator={false}
                />
                <TextInput
                  value={draft.storefrontB2bUrl}
                  placeholder="https://portal.example.com"
                  onChange={(e) => set('storefrontB2bUrl', e.target.value)}
                />
                <Spacings.Inline scale="s" alignItems="center">
                  <EmbedStatus
                    url={draft.storefrontB2bUrl}
                    frameSrcOrigins={buildDefaults.frameSrcOrigins}
                  />
                  {urlProblem(draft.storefrontB2bUrl) && (
                    <Text.Detail tone="critical">
                      {urlProblem(draft.storefrontB2bUrl)}
                    </Text.Detail>
                  )}
                </Spacings.Inline>
                <Text.Detail tone="secondary">
                  Leave blank to send B2B customers to the B2C storefront.
                </Text.Detail>
              </Spacings.Stack>
            </Spacings.Stack>
          </Card>

          <Card theme="light" type="raised">
            <Spacings.Stack scale="m">
              <Text.Subheadline as="h4">Launch behaviour</Text.Subheadline>

              <Spacings.Stack scale="xs">
                <FieldLabel
                  title="How to open the storefront"
                  hasRequiredIndicator={false}
                />
                <div style={{ maxWidth: 420 }}>
                  <SelectInput
                    value={draft.launchMode}
                    options={LAUNCH_MODE_OPTIONS}
                    onChange={(e) =>
                      set('launchMode', e.target.value as TLaunchMode)
                    }
                  />
                </div>
                <Text.Detail tone="secondary">
                  A Custom Application&apos;s Content-Security-Policy is
                  compiled into its bundle, so only origins supplied at build
                  time can be framed. Choosing &ldquo;always embed&rdquo; for an
                  origin outside that list renders a blank iframe — the badges
                  above show which storefronts qualify.
                </Text.Detail>
              </Spacings.Stack>

              <Spacings.Stack scale="xs">
                <FieldLabel
                  title="Launch token lifetime (seconds)"
                  hasRequiredIndicator={false}
                />
                <div style={{ maxWidth: 160 }}>
                  <NumberInput
                    value={draft.tokenTtlSeconds}
                    min={MIN_TOKEN_TTL_SECONDS}
                    max={MAX_TOKEN_TTL_SECONDS}
                    step={30}
                    onChange={(e) =>
                      set(
                        'tokenTtlSeconds',
                        Number(e.target.value) || DEFAULT_TOKEN_TTL_SECONDS
                      )
                    }
                  />
                </div>
                <Text.Detail tone="secondary">
                  {`How long a single-use launch token stays redeemable (${MIN_TOKEN_TTL_SECONDS}–${MAX_TOKEN_TTL_SECONDS}s, default ${DEFAULT_TOKEN_TTL_SECONDS}s). The storefront rejects an expired token, and deletes each one as it is redeemed. Shorter is safer; allow enough time for a slow first page load.`}
                </Text.Detail>
              </Spacings.Stack>
            </Spacings.Stack>
          </Card>

          <Card theme="light" type="raised">
            <Spacings.Stack scale="s">
              <Text.Subheadline as="h4">
                Build-time configuration
              </Text.Subheadline>
              <Text.Detail tone="secondary">
                Read-only. These come from the build environment and are the
                fallback when nothing is saved above.
              </Text.Detail>
              <dl
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'max-content 1fr',
                  gap: '4px 16px',
                  margin: 0,
                  fontSize: 13,
                }}
              >
                <dt style={{ color: '#6b7280' }}>STOREFRONT_B2C_URL</dt>
                <dd style={{ margin: 0 }}>
                  <code>{buildDefaults.storefrontB2cUrl || '— not set —'}</code>
                </dd>
                <dt style={{ color: '#6b7280' }}>STOREFRONT_B2B_URL</dt>
                <dd style={{ margin: 0 }}>
                  <code>{buildDefaults.storefrontB2bUrl || '— not set —'}</code>
                </dd>
                <dt style={{ color: '#6b7280' }}>CSP frame-src</dt>
                <dd style={{ margin: 0 }}>
                  <code>
                    {buildDefaults.frameSrcOrigins.length
                      ? buildDefaults.frameSrcOrigins.join(', ')
                      : '— none: embedding is unavailable in this build —'}
                  </code>
                </dd>
              </dl>
            </Spacings.Stack>
          </Card>

          <Spacings.Inline scale="s" alignItems="center">
            <PrimaryButton
              label={busy ? 'Saving…' : 'Save settings'}
              isDisabled={busy || problems.length > 0}
              onClick={() => void run(() => save(draft), 'Settings saved.')}
            />
            <SecondaryButton
              label="Revert to build defaults"
              isDisabled={busy || !isOverridden}
              onClick={() =>
                void run(
                  () => reset(),
                  'Saved settings removed — the build environment values apply again.'
                )
              }
            />
            {status && (
              <Text.Detail
                tone={status.tone === 'ok' ? 'positive' : 'critical'}
              >
                {status.message}
              </Text.Detail>
            )}
          </Spacings.Inline>

          <Card theme="light" type="raised">
            <Spacings.Stack scale="xs">
              <Text.Subheadline as="h4">
                How the launch is authorized
              </Text.Subheadline>
              <Text.Detail tone="secondary">
                There is no shared secret. This app writes a single-use token as
                a Custom Object in container <code>csr-launch-tokens</code>, and
                the launch URL carries only that token. The storefront reads the
                token with its own commercetools credentials, checks the expiry,
                deletes it, and starts a session as that customer. Because this
                app reaches commercetools through the Merchant Center API
                gateway, a token can only exist if a signed-in Merchant Center
                user with <code>manage_key_value_documents</code> minted it.
              </Text.Detail>
              <Text.Detail tone="secondary">
                Your storefront has to implement the redemption endpoint. See{' '}
                <code>docs/CSR-STOREFRONT-INTEGRATION.md</code> in this
                repository for the contract and a reference implementation.
              </Text.Detail>
            </Spacings.Stack>
          </Card>
        </Spacings.Stack>
      )}
    </Spacings.Stack>
  );
};
Settings.displayName = 'Settings';

export default Settings;
