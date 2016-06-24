/* @flow */
declare module 'measured' {
  declare class MeasuredCollection {
    _metrics: any;

    timer(name: string): MeasuredTimer;

    counter(name: string): MeasuredCounter;

    toJSON(): any;
  }

  declare class MeasuredTimer {
    start(): Stopwatch;
  }

  declare class MeasuredCounter {
    inc(value: number): void;
  }

  declare class Stopwatch {
    end(): void;
  }

  declare function createCollection(): MeasuredCollection;
}
