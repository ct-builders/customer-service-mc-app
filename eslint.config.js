/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

// ENABLE_NEW_JSX_TRANSFORM was set here to 'true'. It is deliberately NOT set
// now: this app builds with the *classic* JSX runtime
// (@commercetools-frontend/babel-preset-mc-app defaults to runtime: 'classic',
// and @emotion/babel-preset-css-prop is only valid with classic), so claiming
// the new transform is simply wrong. See the react/react-in-jsx-scope override
// at the bottom of this file for the guard that matters.

const graphqlPlugin = require('@graphql-eslint/eslint-plugin');
const mcAppConfig = require('@commercetools-frontend/eslint-config-mc-app');

module.exports = [
  {
    // Paths eslint must not walk. Both entries below made `npm run lint`
    // report problems that had nothing to do with the code under review, which
    // is how a lint step stops being read at all.
    ignores: [
      // Build output. `npm run lint` is clean on a fresh clone and reports
      // hundreds of errors the moment anyone runs a build, because eslint
      // happily parses the emitted bundles. A lint result that depends on
      // whether you built recently is a lint result nobody trusts.
      'public/**',
      '.cache/**',
      // Concurrent Claude sessions put their checkouts here, inside this
      // repo, and eslint traverses dot-directories — so every problem gets
      // reported twice, half of them against paths that are not part of this
      // checkout.
      '.claude/**',
    ],
  },
  ...mcAppConfig,
  {
    files: ['**/*.ctp.graphql'],
    plugins: { '@graphql-eslint': graphqlPlugin },
    languageOptions: {
      parser: graphqlPlugin,
      parserOptions: {
        graphQLConfig: {
          schema: './schemas/ctp.json',
        },
      },
    },
    rules: {
      '@graphql-eslint/known-type-names': 'error',
      '@graphql-eslint/known-argument-names': 'error',
      '@graphql-eslint/known-directives': 'error',
      '@graphql-eslint/scalar-leafs': 'error',
    },
  },
  {
    files: ['eslint.config.js'],
    rules: { 'import/extensions': 'off' },
  },
  // Ban the `<>...</>` fragment shorthand. Must come AFTER mcAppConfig.
  //
  // Under this app's classic JSX runtime, ordinary JSX is compiled by
  // @emotion/babel-preset-css-prop into `___EmotionJSX(...)` — which imports
  // itself and needs nothing in scope. Fragments are the one exception: `<>`
  // compiles to a bare `React.Fragment`, so a file using it without
  // `import React from 'react'` type-checks, builds, and then dies at render
  // with `ReferenceError: React is not defined` — visible only once the app is
  // running inside the Merchant Center.
  //
  // `react/react-in-jsx-scope` is the obvious guard but is far too broad here:
  // it demands a React import in every one of the ~30 components, none of which
  // actually need one. Banning the shorthand instead targets exactly the trap.
  // `<React.Fragment>` is required in its place, which makes the dependency on
  // React visible at the point of use rather than invisible.
  {
    files: ['src/**/*.tsx'],
    rules: { 'react/jsx-fragments': ['error', 'element'] },
  },
];
