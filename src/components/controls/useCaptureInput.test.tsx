import { describe, it, expect, vi } from 'vitest';
import { fireEvent, renderHook } from '@testing-library/react';
import { useCaptureInput } from './useCaptureInput';

const setup = (active: boolean) => {
    const onCapture = vi.fn();
    const onCancel = vi.fn();
    const hook = renderHook(({ on }) => useCaptureInput(on, onCapture, onCancel), { initialProps: { on: active } });
    return { onCapture, onCancel, hook };
};

describe('useCaptureInput', () => {
    it('captures the next key by its position, normalizing modifier sides', () => {
        const { onCapture } = setup(true);
        fireEvent.keyDown(window, { code: 'KeyE', key: 'e' });
        expect(onCapture).toHaveBeenLastCalledWith('KeyE');
        fireEvent.keyDown(window, { code: 'ShiftRight', key: 'Shift' });
        expect(onCapture).toHaveBeenLastCalledWith('Shift');
    });

    it('ignores reserved keys and keeps waiting', () => {
        const { onCapture, onCancel } = setup(true);
        fireEvent.keyDown(window, { code: 'Digit3', key: '3' });
        expect(onCapture).not.toHaveBeenCalled();
        expect(onCancel).not.toHaveBeenCalled();
    });

    it('cancels on Escape and keeps it from reaching other handlers', () => {
        const { onCapture, onCancel } = setup(true);
        const other = vi.fn();
        window.addEventListener('keydown', other);
        fireEvent.keyDown(window, { code: 'Escape', key: 'Escape' });
        window.removeEventListener('keydown', other);
        expect(onCancel).toHaveBeenCalledTimes(1);
        expect(onCapture).not.toHaveBeenCalled();
        expect(other).not.toHaveBeenCalled();
    });

    it('captures mouse buttons', () => {
        const { onCapture } = setup(true);
        fireEvent.mouseDown(window, { button: 1 });
        expect(onCapture).toHaveBeenLastCalledWith('Mouse1');
    });

    it('swallows the click that follows a captured mouse button, even after the capture closed', () => {
        const { hook } = setup(true);
        const clicked = vi.fn();
        window.addEventListener('click', clicked);
        fireEvent.mouseDown(window, { button: 0 });
        hook.rerender({ on: false }); // the slot got its input: the capture closes before the button comes up
        fireEvent.mouseUp(window, { button: 0 });
        fireEvent.click(window, { button: 0 });
        window.removeEventListener('click', clicked);
        expect(clicked).not.toHaveBeenCalled();
    });

    it('lets clicks through again once the captured button is up', () => {
        vi.useFakeTimers();
        try {
            const { hook } = setup(true);
            fireEvent.mouseDown(window, { button: 0 });
            hook.rerender({ on: false });
            fireEvent.mouseUp(window, { button: 0 });
            vi.runOnlyPendingTimers();
            const clicked = vi.fn();
            window.addEventListener('click', clicked);
            fireEvent.click(window);
            window.removeEventListener('click', clicked);
            expect(clicked).toHaveBeenCalledTimes(1);
        } finally {
            vi.useRealTimers();
        }
    });

    it('lets clicks through on the next press when the release never arrived (button let go outside the window)', () => {
        const { hook } = setup(true);
        fireEvent.mouseDown(window, { button: 0 });
        hook.rerender({ on: false });
        const clicked = vi.fn();
        window.addEventListener('click', clicked);
        fireEvent.mouseDown(window, { button: 0 });
        fireEvent.click(window);
        window.removeEventListener('click', clicked);
        expect(clicked).toHaveBeenCalledTimes(1);
    });

    it('keeps the back / forward buttons from navigating', () => {
        setup(true);
        const up = new MouseEvent('mouseup', { button: 3, cancelable: true });
        window.dispatchEvent(up);
        expect(up.defaultPrevented).toBe(true);
    });

    it('listens to nothing while inactive or after unmount', () => {
        const { onCapture, hook } = setup(false);
        fireEvent.keyDown(window, { code: 'KeyE' });
        hook.rerender({ on: true });
        hook.unmount();
        fireEvent.keyDown(window, { code: 'KeyE' });
        fireEvent.mouseDown(window, { button: 0 });
        expect(onCapture).not.toHaveBeenCalled();
    });
});
