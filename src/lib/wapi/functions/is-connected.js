/**
 * Check if phone is connected
 * @param {Function} done Optional callback
 */
export function isConnected(done) {
  // Phone Disconnected icon appears when phone is disconnected from the tnternet
  const isConnected =
    document.querySelector('[data-testid="alert-phone"]') == null &&
    document.querySelector('[data-testid="alert-computer"]') == null
      ? true
      : false;

  if (done !== undefined) done(isConnected);
  return isConnected;
}
