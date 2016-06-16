/* @flow */
declare module 'invariant' {
  declare class Invariant {
    (condition: boolean, message: string): any;
  }
  declare var exports: Invariant;
}
