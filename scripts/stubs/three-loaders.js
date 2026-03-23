// Stub for unused three.js add-ons pulled in by @newkrok/three-utils.
// Provides no-op constructors so imports won't throw.
const noop = function () {};
noop.prototype.load = noop;
noop.prototype.parse = noop;

export const GLTFLoader = noop;
export const FBXLoader = noop;
export const PositionalAudioHelper = noop;
export const clone = noop;
