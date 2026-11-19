// Whether the device has a mouse or trackpad. Without one (phones, most tablets) there is no keyboard
// to bind either, so the profile hides its Controls tab.

export const hasFinePointer = (): boolean =>
    typeof window.matchMedia === 'function' ? window.matchMedia('(any-pointer: fine)').matches : true;
