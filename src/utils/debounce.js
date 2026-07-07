export function createDebouncer(delayMs) {
  let timerId = null;

  function schedule(fn) {
    if (timerId !== null) clearTimeout(timerId);
    timerId = setTimeout(() => {
      timerId = null;
      fn();
    }, delayMs);
  }

  function cancel() {
    if (timerId !== null) {
      clearTimeout(timerId);
      timerId = null;
    }
  }

  return { schedule, cancel };
}
