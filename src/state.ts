import { debounce, throttle } from "tiny-throttle";
import { isPlainObject } from "./helpers";

const isProxy = Symbol("isProxy")

export const unreachable = (x: never): never => {
  throw new Error('Unreachable function reached!');
}

const isDefined: (x: unknown) => boolean = x => x !== null && x !== undefined

interface PropCallback<T> {
  (arg: T): void
}

interface PropMapper<T, K> {
  (arg: T): K
}

const getPropProxy = <T, K extends Prop<T>>(property: K): K => {
  const propCache: { [key: string]: Prop<unknown> } = {};

  return new Proxy(property, {
    get(target: Prop<T>, prop) {
      let propName = String(prop);
      if (propName.endsWith('$') && !target.hasOwnProperty(propName)) {
        let propNameSliced = propName.slice(0, propName.length - 1);
        let prop$ = propCache[propName];
        if (!prop$) {
          if (target instanceof Prop && isPlainObject(target.value)) {
            prop$ = target.bindProperty(propNameSliced);
          } else {
            prop$ = target.map(x => x?.[propNameSliced]);
          }
          propCache[propName] = prop$;
        }
        return prop$;
      }
      return target[prop];
    }
  }) as K;
}

type usePropOptions = {
  pending?: boolean,
}

export const useProp = <T>(value: T, options: usePropOptions = {}): Prop<T> => {
  const prop = new Prop(value, !options.pending) as Prop<T>;
  return getPropProxy(prop);
}

useProp.pending = <T>(): Prop<T> => {
  return useProp(null, { pending: true }) as Prop<T>;
}

export const usePropWithError = <T>(value: T, options: usePropOptions = {}): PropWithError<T> => {
  const prop = new PropWithError(value, !options.pending) as PropWithError<T>;
  return getPropProxy(prop);
}

usePropWithError.pending = <T>(): PropWithError<T> => {
  return usePropWithError(null, { pending: true }) as PropWithError<T>;
}

export type RouterState = {
  state: object,
  path: string,
  title: string,
  hash: string
}

export const useLocation = (): Prop<RouterState> => {
  const getCurrentState = (): RouterState => ({
    state: window.history.state,
    path: window.location.pathname,
    hash: window.location.hash,
    title: ''
  });

  const route$: Prop<RouterState> = useProp(getCurrentState());
  mergeEvent(route$, window, 'popstate', { 
    transform: getCurrentState
  });
  mergeEvent(route$, window, 'navigation', {
    transform: getCurrentState
  });
  return route$;
}

type useEventOptions = { 
  throttle?: number,
  debounce?: number,
  debounceLeading?: boolean,
  transform?: (e: Event) => any
}

export const useEvent = (target: Node, eventName: string, options: useEventOptions = {}): Prop<Event | null> => {
  const prop: Prop<Event> = useProp.pending();
  mergeEvent(prop, target, eventName, options);
  return prop;
}

export const mergeEvent = (bus: Prop<unknown>, target: Node, eventName: string, options: useEventOptions = {}): void => {
  let callback;
  if (options.transform && typeof options.transform === 'function') {
    callback = (event) => {
      bus.next(options.transform!(event));
    }
  } else {
    callback = (event) => {
      bus.next(event);
    }
  }
  if (options.debounce && Number(options.debounce) > 0) {
    callback = debounce(callback, options.debounce, options.debounceLeading);
  } else if (options.throttle && Number(options.throttle) > 0) {
    callback = throttle(callback, options.throttle);
  }
  bus.onEnd(() => {
    target.removeEventListener(eventName, callback);
  })
  target.addEventListener(eventName, callback);
}

export const usePromise = <T>(promise: Promise<T>): PropWithError<T> => {
  const prop: PropWithError<T> = usePropWithError.pending();
  mergePromise(prop, promise);
  return prop;
}

export const mergePromise = <T>(prop: PropWithError<T>, promise: Promise<T>): void => {
  promise.then((value: T) => {
    prop.next(value);
    prop.error$.next(null);
  }).catch((error: any) => {
    if (error instanceof Error) {
      prop.error$.next(error);
    } else {
      prop.error$.next(new Error(error));
    }
  });
}

const walkObject = (x: object, basePath: Array<string>, callback: (value: any, path: string[]) => void): void => {
  const keys = Object.keys(x);
  for (let i = 0; i < keys.length; i++) {
    const path = [...basePath, keys[i]];
    if (isPlainObject(x[keys[i]])) {
      walkObject(x[keys[i]], path, callback);
    } else {
      callback(x[keys[i]], path);
    }
  }
}

const deepSet = (x: object, path: string[], value: unknown): void => {
  let level: object = x;
  for(let i = 0; i < path.length; i++) {
    if (i === path.length - 1) {
      Object.assign(level, { [path[i]]: value });
      // level[path[i]] = value;
    } else {
      if (!level[path[i]]) {
        level[path[i]] = {}
      }
      level = level[path[i]];
    }
  }
}

export const merge = <T>(...props: Prop<T>[]): Prop<T> => {
  const prop: Prop<T> = useProp.pending();
  for (let i = 0; i < props.length; i++) {
    prop.onEnd(props[i].subscribe(x => {
      prop.next(x);
    }));
  }
  return prop;
}

export const compose = (...props: Prop<unknown>[]): Prop<unknown[]> => {
  const res: unknown[] = [];
  for (let i = 0; i < props.length; i++) {
    res.push((props[i]).value);
  }
  const prop: Prop<unknown[]> = useProp(res);
  for (let i = 0; i < props.length; i++) {
    props[i].subscribe(x => {
      res[i] = x;
      prop.next(res);
    });
  }
  return prop;
}

export const composeObject = <T extends object>(template: object): Prop<T> => {
  const res: T = {} as T, props: Array<[string[], Prop<unknown>]> = new Array();
  walkObject(template, [], (x, path: string[]) => {
    if (x instanceof Prop) {
      deepSet(res, path, x.value);
      props.push([path, x]);
    }
  });
  const prop: Prop<T> = useProp(res);
  for (let i = 0; i < props.length; i++) {
    props[i][1].subscribe((newValue) => {
      deepSet(res, props[i][0], newValue);
      prop.next(res);
    });
  }
  return prop;
}

export const not = (prop: Prop<unknown>): Prop<boolean> => {
  return prop.map(x => !x);
}

export const every = (...props: Prop<unknown>[]): Prop<boolean> => {
  return compose(...props).map((x: unknown[]) => x.every(x => x));
}

export const some = (...props: Prop<unknown>[]): Prop<boolean> => {
  return compose(...props).map((x: unknown[]) => x.some(x => x));
}

export class Prop<T> {
  protected callbacks: { [arg: string]: PropCallback<T> } = {};
  protected endCallbacks: Function[] = [];
  protected ended = false;
  protected currentValue: T;
  protected initialized: boolean = false;

  [key: `${string}$`]: Prop<any>;

  constructor(value: T | null, initialize = true) {
    if (initialize) {
      this.setCurrentValue(value as T);
    }
  }

  set value(value: T) {
    this.next(value);
  }

  getValue(): T {
    return this.currentValue;
  }

  get value(): T {
    return this.getValue();
  }

  next(value: T): void {
    this.setCurrentValue(value);
    for (let key in this.callbacks) {
      this.runCallback(key, value);
    }
  }

  set = this.next

  tap() {
    this.next(this.currentValue);
  }

  update(updateFn: (rawValue: T) => void): void {
    updateFn(this.currentValue);
    this.tap();
  }

  subscribe(callback: PropCallback<T>): Function {
    if (this.ended) {
      return () => {}
    }
    const key = crypto.randomUUID();
    this.callbacks[key] = callback;
    this.runCallback(key, this.currentValue);
    return () => {
      this.unsubscribe(key);
    };
  }

  unsubscribe(key: string): void {
    if (this.callbacks[key]) {
      delete this.callbacks[key];      
    }
  }

  filter(filterFn: (arg: T) => boolean = isDefined): Prop<T> {
    const prop: Prop<T> = useProp.pending();
    prop.onEnd(this.subscribe(value => {
      if (filterFn(value)) {
        prop.next(value);
      }
    }));
    return prop;
  }

  await(filterFn: (arg: T) => boolean = isDefined): Prop<T> {
    const prop = this.filter(filterFn);
    prop.onEnd(prop.subscribe(() => {
      prop.end();
    }));
    return prop;
  }

  map<K>(mapper: PropMapper<T, K>): Prop<K> {
    const prop: Prop<K> = useProp.pending();
    prop.onEnd(this.subscribe(value => prop.next(mapper(value))));
    return prop;
  }

  mapOnce<K>(mapper: PropMapper<T, K>): Prop<K> {
    const prop = this.map(mapper);
    prop.onEnd(prop.subscribe(() => prop.end()));
    return prop;
  }

  mapUniq<K>(mapper: PropMapper<T, K>): Prop<K> {
    const prop: Prop<K> = useProp.pending();
    prop.onEnd(this.subscribe(value => {
      const newValue = mapper(value);
      if (prop.value !== newValue) {
        prop.next(newValue);
      }
    }));
    return prop;
  }

  merge(...props: Prop<T>[]): void {
    for (let i = 0; i < props.length; i++) {
      this.onEnd(props[i].subscribe(x => {
        this.next(x);
      }));
    }
  }

  bindProperty<K extends T[keyof T]>(key: string, mapper?: PropMapper<T, K>): Prop<K> {
    if (!isPlainObject(this.currentValue) || Array.isArray(this.currentValue)) {
      throw new Error('Property must be initialized with an object or an array to call `bindProperty`')
    }
    let prop;
    if (mapper && typeof mapper === 'function') {
      prop = this.mapUniq(x => mapper(x[key]));
    } else {
      prop = this.mapUniq(x => x[key]);
    }
    this.onEnd(prop.subscribe(x => {
      if (this.value?.[key] !== x) {
        this.update(value => {
          value[key] = x;
        });
      }
    }));
    return prop;
  }

  end() {
    this.ended = true;
    const keys = Object.keys(this.callbacks);
    for (let i = 0; i < keys.length; i++) {
      this.unsubscribe(keys[i]);
    }
    for (let i = 0; i < this.endCallbacks.length; i++) {
      this.endCallbacks[i]();
    }
    this.endCallbacks.length = 0;
  }

  onEnd(callback: Function) {
    this.endCallbacks.push(callback);
  }

  protected setCurrentValue(value: T): void {
    this.initialized = true;
    if (this.currentValue !== value) {
      this.currentValue = value;
    }
  }

  protected runCallback(key: string, value: T): void {
    if (this.initialized) {
      this.callbacks[key](value);
    }
  }
}

export class PropWithError<T> extends Prop<T> {
  public readonly error$: Prop<Error | null>;

  constructor(value: T | null, initialize = true) {
    super(value, initialize);
    this.error$ = useProp(null, { pending: true });
  }
}

export class NodeRef extends Prop<Node> {
  constructor() {
    super(null, false);
  }

  next(value: Node): void {
    super.next(value);
    this.end();
  }
}