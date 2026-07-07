import { createDebouncer } from '../../utils/debounce';

beforeEach(() => {
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  jest.useRealTimers();
});

test('delay 이후 예약 함수가 1회 실행된다', () => {
  const debouncer = createDebouncer(800);
  const fn = jest.fn();

  debouncer.schedule(fn);

  expect(fn).not.toHaveBeenCalled();
  jest.advanceTimersByTime(800);
  expect(fn).toHaveBeenCalledTimes(1);
});

test('delay 이내에 schedule을 여러 번 호출하면 마지막 호출만 실행된다', () => {
  const debouncer = createDebouncer(800);
  const first = jest.fn();
  const second = jest.fn();
  const third = jest.fn();

  debouncer.schedule(first);
  jest.advanceTimersByTime(400);
  debouncer.schedule(second);
  jest.advanceTimersByTime(400);
  debouncer.schedule(third);
  jest.advanceTimersByTime(800);

  expect(first).not.toHaveBeenCalled();
  expect(second).not.toHaveBeenCalled();
  expect(third).toHaveBeenCalledTimes(1);
});

test('cancel을 호출하면 예약 함수가 실행되지 않는다', () => {
  const debouncer = createDebouncer(800);
  const fn = jest.fn();

  debouncer.schedule(fn);
  debouncer.cancel();
  jest.advanceTimersByTime(800);

  expect(fn).not.toHaveBeenCalled();
});
