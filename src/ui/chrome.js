/**
 * How much of the bottom of the screen is covered by fixed chrome.
 *
 * Three things live at `bottom: 0` — the tab bar, the session action bar and
 * the rest timer, in changing combinations — and the scrolling content has to
 * reserve exactly that much room or its last element cannot be reached. That
 * was being done with hand-added constants, and they were wrong: the action bar
 * is 88px + safe area (12 + a 64px button + 12), the rest bar stacks another
 * ~44px on top of it, and the session screen reserved 104px for both. The last
 * element of a lift editor is the RPE row, so the RPE row was the thing you
 * could not scroll to, on exactly the sessions where a rest timer was running.
 *
 * Measuring is the fix. Two custom properties on <body>, kept current by
 * observers, and the CSS reads them:
 *   --actionbar-h    height of the action bar (0 when there is none)
 *   --bottom-chrome  everything covering the bottom edge right now
 *
 * Writes are coalesced into one animation frame, so the rest timer ticking or a
 * chip toggling costs two getBoundingClientRect calls per frame at most.
 */

const px = (n) => `${Math.round(n)}px`;
const heightOf = (node) => (node && !node.hidden ? node.getBoundingClientRect().height : 0);

export function syncBottomChrome() {
  const body = document.body;
  if (!body) return;
  const inSession = body.dataset.session === 'active';
  const action = heightOf(document.querySelector('.actionbar'));
  const rest = heightOf(document.getElementById('rest-bar'));
  // The tab bar is hidden for the duration of a session (see base.css).
  const tabbar = inSession ? 0 : heightOf(document.getElementById('tabbar'));

  body.style.setProperty('--actionbar-h', px(action));
  body.style.setProperty('--bottom-chrome', px(action + rest + tabbar));
}

/**
 * Scroll `node` clear of the bottom chrome, but only if something is actually
 * covering it.
 *
 * Logging a set starts the rest timer, and the rest bar appears a frame later —
 * on top of the controls for the set you are about to do. Reserving room is not
 * enough on its own: the page does not move, so the next set's RPE row ends up
 * under a bar that was not there when you tapped. This nudges it back into
 * view, and does nothing when the editor is already clear, so it never fights
 * a deliberate scroll.
 */
export function revealBelowChrome(node, { margin = 8 } = {}) {
  if (!node) return;
  const chrome = parseFloat(getComputedStyle(document.body).getPropertyValue('--bottom-chrome')) || 0;
  const bottom = node.getBoundingClientRect().bottom;
  const limit = window.innerHeight - chrome - margin;
  if (bottom <= limit) return;
  window.scrollBy({ top: bottom - limit, behavior: 'smooth' });
}

/**
 * Keep the measurements current for the life of the page.
 * Returns a teardown function (unused in the app; the observers live as long as
 * the document does).
 */
export function trackBottomChrome() {
  let frame = null;
  const schedule = () => {
    if (frame != null) return;
    frame = requestAnimationFrame(() => {
      frame = null;
      syncBottomChrome();
    });
  };

  // Screens mount and unmount their action bar on every render, and the rest
  // bar toggles `hidden`. Attributes are filtered so a rest tick (which only
  // changes text) does not wake this up.
  const mo = new MutationObserver(schedule);
  mo.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['hidden', 'class', 'data-session', 'style'],
  });

  // Rotation and the iOS keyboard change the safe-area insets under us.
  window.addEventListener('resize', schedule);
  window.addEventListener('orientationchange', schedule);
  window.visualViewport?.addEventListener('resize', schedule);

  syncBottomChrome();
  return () => {
    mo.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('orientationchange', schedule);
    window.visualViewport?.removeEventListener('resize', schedule);
  };
}
