import { createElement } from 'react';
import { act, create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, test, vi } from 'vitest';

const events = vi.hoisted(() => ({ clickAway: () => {} }));

vi.mock('react-i18next', () => ({
  useTranslation: () => [(key: string) => key],
}));
vi.mock('$app/common/colors', () => ({ useColorScheme: () => ({}) }));
vi.mock('$app/common/hooks/useReactSettings', () => ({
  useReactSettings: () => ({}),
}));
vi.mock('$app/common/helpers/request', () => ({ request: vi.fn() }));
vi.mock('$app/components/ErrorMessage', () => ({ ErrorMessage: () => null }));
vi.mock('react-use', () => ({
  useDebounce: () => {},
  useClickAway: (_ref: unknown, callback: () => void) => {
    events.clickAway = callback;
  },
}));

// Keep real ComboboxStatic state/effects and mock only Headless UI's DOM shell.
vi.mock('@headlessui/react', async () => {
  const { createElement, forwardRef } = await import('react');
  const shell = (tag: string, testId: string) =>
    forwardRef<HTMLElement, any>((props, ref) =>
      createElement(
        tag,
        { ...props, ref, 'data-testid': testId },
        typeof props.children === 'function'
          ? props.children({ selected: false })
          : props.children
      )
    );
  const Combobox = Object.assign(shell('div', 'mock-combobox'), {
    Input: shell('input', 'combobox-input-field'),
    Label: shell('label', 'mock-label'),
    Button: shell('button', 'mock-button'),
    Options: shell('ul', 'mock-options'),
    Option: shell('li', 'mock-option'),
  });
  return { Combobox };
});

import {
  ComboboxStatic,
  type ComboboxStaticProps,
  type Entry,
} from '../../../src/components/forms/Combobox';

const owner = (id: string, label: string): Entry => ({
  id,
  value: id,
  label,
  resource: null,
  eventType: 'external',
  searchable: label,
});
const first = owner('1', 'Original owner');
const second = owner('2', 'New owner');

describe('opt-in active combobox search during result refresh', () => {
  let renderer: ReactTestRenderer;
  let props: ComboboxStaticProps;
  let blur: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    blur = vi.fn();
    props = {
      inputOptions: { value: first.value },
      entries: [first],
      entryOptions: { id: 'id', label: 'label', value: 'value' },
      onChange: vi.fn(),
      onDismiss: vi.fn(),
      preserveSearchOnEntriesChange: true,
    };
    act(() => {
      renderer = create(createElement(ComboboxStatic, props), {
        createNodeMock: (node) => (node.type === 'input' ? { blur } : null),
      });
    });
    blur.mockClear();
  });
  const input = () =>
    renderer.root.findByProps({ 'data-testid': 'combobox-input-field' });
  const open = () =>
    renderer.root.findAllByProps({ 'data-testid': 'mock-options' }).length > 0;
  const search = () =>
    act(() => {
      input().props.onClick();
      input().props.onChange({ target: { value: 'New owner' } });
    });
  const update = (changes: Partial<ComboboxStaticProps> = {}) =>
    act(() => {
      props = { ...props, entries: [{ ...first }, { ...second }], ...changes };
      renderer.update(createElement(ComboboxStatic, props));
    });

  test('keeps a populated owner search open and does not blur on async refresh', () => {
    search();
    update();
    expect(open()).toBe(true);
    expect(blur).not.toHaveBeenCalled();
    expect(
      renderer.root.findByProps({ 'data-testid': 'mock-option' }).props.value
        .label
    ).toBe(second.label);
    expect(props.onChange).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  test('selection still closes, blurs, and notifies the caller once', () => {
    search();
    update();
    act(() =>
      renderer.root
        .findByProps({ 'data-testid': 'mock-combobox' })
        .props.onChange(second)
    );
    expect(open()).toBe(false);
    expect(blur).toHaveBeenCalledOnce();
    expect(props.onChange).toHaveBeenCalledOnce();
    expect(props.onChange).toHaveBeenCalledWith(
      expect.objectContaining({ value: second.value, eventType: 'internal' })
    );
    act(() => renderer.unmount());
  });

  test('external owner changes still close the active search and sync selection', () => {
    search();
    update({ inputOptions: { value: second.value } });
    expect(open()).toBe(false);
    expect(blur).toHaveBeenCalledOnce();
    expect(
      renderer.root.findByProps({ 'data-testid': 'mock-combobox' }).props.value
        .value
    ).toBe(second.value);
    expect(props.onChange).not.toHaveBeenCalled();
    act(() => renderer.unmount());
  });

  test('click-away dismissal stays closed when delayed results arrive', () => {
    search();
    act(() => events.clickAway());
    update();
    expect(open()).toBe(false);
    act(() => renderer.unmount());
  });

  test('clearing the selection keeps normal dismissal behavior', () => {
    search();
    update();
    act(() =>
      renderer.root
        .findByProps({ 'data-testid': 'mock-button' })
        .props.onClick({ preventDefault: vi.fn() })
    );
    expect(open()).toBe(false);
    expect(props.onDismiss).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });

  test('existing selectors retain their refresh behavior without opting in', () => {
    update({ preserveSearchOnEntriesChange: undefined });
    blur.mockClear();
    search();
    update();
    expect(open()).toBe(false);
    expect(blur).toHaveBeenCalledOnce();
    act(() => renderer.unmount());
  });
});
