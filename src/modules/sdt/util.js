// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

export const debugMode = false;

/**
 * Log debug message if debug is enabled .
 *
 * @param {...any} args log arguments
 */
export function logDebug(...args) {
  if (debugMode) {
    console.log('[BII]', ...args);
  }
}
