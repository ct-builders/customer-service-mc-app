/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 commercetools GmbH and the ct-builders contributors
 * Freely available, AS IS and UNSUPPORTED. See LICENSE.
 */

process.env.ENABLE_NEW_JSX_TRANSFORM = 'true';

/**
 * @type {import('@jest/types').Config.ProjectConfig}
 */
module.exports = {
  // Only this checkout. Concurrent Claude sessions keep worktrees under
  // `.claude/`, and without this jest discovers their copies of every spec and
  // runs the whole suite twice — reporting double the real test count.
  roots: ['<rootDir>/src'],

  preset: '@commercetools-frontend/jest-preset-mc-app/typescript',
};
