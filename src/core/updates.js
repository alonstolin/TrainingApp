/**
 * Update policy. DOM-free, pure.
 *
 * Separated from the service-worker plumbing in main.js because the plumbing
 * cannot be unit-tested and the decision is where the bug was.
 */

/**
 * What to do about a service worker that is installed and waiting.
 *
 * @param {{waiting:boolean, activeSession:boolean}} o
 * @returns {'apply'|'prompt'|'none'}
 */
export function updateDecision({ waiting, activeSession } = {}) {
  if (!waiting) return 'none';
  // Mid-workout, a reload would discard the set being entered. Offer it instead.
  if (activeSession) return 'prompt';
  // Otherwise just take it. At launch there is nothing on screen to lose, and
  // requiring a tap to accept the obviously-right thing is how people end up
  // running a months-old build without realising.
  return 'apply';
}
