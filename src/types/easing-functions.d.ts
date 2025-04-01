declare module 'easing-functions' {
  /**
   * Easing function signature
   * @param t - The time or progress value (usually between 0 and 1).
   * @returns The eased value (usually between 0 and 1).
   */
  export type EasingFunction = (t: number) => number;

  interface EasingType {
    None: EasingFunction;
    In: EasingFunction;
    Out: EasingFunction;
    InOut: EasingFunction;
  }

  const Easing: {
    Linear: EasingType;
    Quadratic: EasingType;
    Cubic: EasingType;
    Quartic: EasingType;
    Quintic: EasingType;
    Sinusoidal: EasingType;
    Exponential: EasingType;
    Circular: EasingType;
    Back: EasingType;
    Elastic: EasingType;
    Bounce: EasingType;
  };

  export default Easing;
}
