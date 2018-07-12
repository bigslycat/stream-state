/* @flow */

import { Observable, type ObservableInterface } from 'es-observable';

import { map } from './map';
import { StoreObservable } from './StoreObservable';
// eslint-disable-next-line no-unused-vars
import { StateSubject } from './StateSubject';
import { Store, type StoreLike } from './Store';
import {
  Queue,
  type PayloadHandler,
  type PayloadPromiseHandler,
  type PayloadObservableHandler,
  type PromiseSetter,
  type ObservableSetter,
} from './Queue';
import { Bee } from './Bee';

export type ActionsSpec<S> = {
  [string]: Bee<S, any>,
};

export type GetNextType<S> = <B: Bee<S, any>>(B) => $PropertyType<B, 'next'>;

export type StateObject<S, SP: ActionsSpec<S>> = {|
  ...$Exact<$ObjMap<SP, GetNextType<S>>>,
  state: S,
|};

class Honeycomb<S> extends StoreObservable<S>
  implements ObservableInterface<S>, StoreLike<S> {
  #queue /* : Queue<S> */;

  #store /* : Store<S> */;

  #mainSubject /* : StateSubject<S> */;

  #createCaseEmitters /* : () => * */;

  constructor(initialState: S) {
    const store = Store.of(initialState);
    const mainSubject = new StateSubject(store);
    const queue = new Queue(store);
    super(store, mainSubject);
    this.#mainSubject = mainSubject;
    this.#queue = queue;
    this.#store = store;

    this.#createCaseEmitters = () => {
      const caseSubject: StateSubject<S> = new StateSubject(store);

      return {
        queue,
        store,
        caseSubject,
        next(newState: S) {
          store.setState(newState);
          caseSubject.next(newState);
          mainSubject.next(newState);
        },
        error(err: Error) {
          caseSubject.error(err);
          mainSubject.error(err);
        },
      };
    };
  }

  bee<P>(handler: PayloadHandler<S, P>): Bee<S, P> {
    return this.case(handler);
  }

  case<P>(handler: PayloadHandler<S, P>): Bee<S, P> {
    const createCaseEmitters = this.#createCaseEmitters;
    const { queue, store, caseSubject, next } = createCaseEmitters();
    return new Bee(store, caseSubject, queue.case(handler, next));
  }

  willBee<P>(handler: PayloadPromiseHandler<S, P>): Bee<S, P> {
    return this.fromPromise(handler);
  }

  fromPromise<P>(handler: PayloadPromiseHandler<S, P>): Bee<S, P> {
    const createCaseEmitters = this.#createCaseEmitters;
    const { queue, store, caseSubject, next, error } = createCaseEmitters();
    return new Bee(store, caseSubject, queue.fromPromise(handler, next, error));
  }

  willBees<P>(handler: PayloadObservableHandler<S, P>): Bee<S, P> {
    return this.fromObservable(handler);
  }

  fromObservable<P>(handler: PayloadObservableHandler<S, P>): Bee<S, P> {
    const createCaseEmitters = this.#createCaseEmitters;
    const { queue, store, caseSubject, next, error } = createCaseEmitters();
    return new Bee(
      store,
      caseSubject,
      queue.fromObservable(handler, next, error),
    );
  }

  awaitBee<P>(handler: PromiseSetter<S, P>): Bee<S, P> {
    return this.awaitPromise(handler);
  }

  awaitPromise<P>(handler: PromiseSetter<S, P>): Bee<S, P> {
    const createCaseEmitters = this.#createCaseEmitters;
    const { queue, store, caseSubject, next, error } = createCaseEmitters();
    return new Bee(
      store,
      caseSubject,
      queue.awaitPromise(handler, next, error),
    );
  }

  awaitBees<P>(handler: ObservableSetter<S, P>): Bee<S, P> {
    return this.awaitObservable(handler);
  }

  awaitObservable<P>(handler: ObservableSetter<S, P>): Bee<S, P> {
    const createCaseEmitters = this.#createCaseEmitters;
    const { queue, store, caseSubject, next, error } = createCaseEmitters();
    return new Bee(
      store,
      caseSubject,
      queue.awaitObservable(handler, next, error),
    );
  }

  createStoreObservable<SP: ActionsSpec<S>>(
    bees: SP,
  ): Observable<StateObject<S, SP>> {
    const methods = Object.entries(bees).reduce(
      (acc, [key, bee]: [string, any]) => {
        acc[key] = value => bee.next(value);
        return acc;
      },
      {},
    );

    return map((state: S) => ({ ...methods, state }), this);
  }
}

export type { Honeycomb };

export function of<T>(initialState: T): Honeycomb<T> {
  return new Honeycomb(initialState);
}