declare module '@newkrok/three-utils' {
  export namespace ObjectUtils {
    export function mergeObjects<T extends object, U extends object>(
      obj1: T,
      obj2: U
    ): T & U;

    export function clone<T>(obj: T): T;

    export function isEmpty(obj: object): boolean;

    export function patchObject<T extends object>(
      target: T,
      patch: Partial<T>
    ): T;
  }
}
