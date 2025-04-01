declare module 'three/examples/jsm/misc/Gyroscope.js' {
  import { Object3D } from 'three';

  /**
   * Gyroscope class
   * Extends Object3D to provide gyroscopic behavior.
   */
  export class Gyroscope extends Object3D {
    constructor();

    /**
     * Updates the gyroscope's transformation relative to its parent.
     */
    updateMatrixWorld(force?: boolean): void;
  }
}
