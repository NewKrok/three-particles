declare module '@newkrok/three-utils' {
  export namespace ObjectUtils {
    export function deepMerge<T extends object, U extends object>(
      obj1: T,
      obj2: U,
      config: object
    ): T & U;

    export function clone<T>(obj: T): T;

    export function isEmpty(obj: object): boolean;

    export function patchObject<T extends object>(
      target: T,
      patch: Partial<T>
    ): T;
  }
}
