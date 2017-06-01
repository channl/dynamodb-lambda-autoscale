/* @flow */
declare module 'async' {
  declare type WorkerFunc<TIn, TOut> = (params: TIn, callback: (result: TOut) => void) => Promise<void>;

  declare class QueueObject<TIn, TOut> {
    length(): number,
    started: boolean,
    running(): boolean,
    workersList(): TIn[],
    idle(): boolean,
    concurrency: number,
    push(task: TIn, callback: (result: TOut | Promise<TOut>) => void): void,
    unshift(task: TIn, callback: (result: TOut | Promise<TOut>) => void): void,
    remove(test: () => boolean): void,
    saturated: () => void,
    unsaturated: () => void,
    buffer: number,
    empty: () => void,
    drain: () => void,
    error: (error: Error, task: TIn) => void,
    paused: boolean,
    pause(): void,
    resume(): void,
    kill(): void,
  }

  declare function queue<TIn, TOut>(worker: WorkerFunc<TIn, TOut>, concurrency?: number): QueueObject<TIn, TOut>;
}
