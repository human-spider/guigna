import { text, setAttr, setStyle, mount, unmount, RedomElement } from 'redom';
import { Prop, useProp } from './state';
import { h } from './html';

export type RedomElements = RedomElement | RedomElement[];

export interface nextCallbackFn {
    (left: RedomElement, right: any): void
  }

export function isPlainObject(obj) {
    if (!obj) return false;
    const prototype = Object.getPrototypeOf(obj);
    return prototype === null || prototype.constructor === Object;
  }

function elementsArray(arg: RedomElements): RedomElement[] {
  if (Array.isArray(arg)) {
    return arg;
  }
  return [arg];
}

const getEl = (arg: RedomElement): Element => {
  if (arg.el) {
    return arg.el;
  }
  return arg;
}

const mountElements = (marker, elements) => {
    for (let i = 0; i < elements.length; i++) {
      mount(marker.parentNode, elements[i], marker);
    }
  }

const unmountElements = (marker, elements) => {
    for (let i = 0; i < elements.length; i++) {
      unmount(marker.parentNode, elements[i]);
    }
  }
  
type ReactiveOptions = {
  onmountCallback?: Function,
  onunmountCallback?: Function
}

export const reactive = (model: Prop<any>) => (el: RedomElement) => (nextCallback: nextCallbackFn, options: ReactiveOptions = {}): RedomElement => {
  let unsub;
  return {
    el,
    onmount() {
      if (!unsub) {
        unsub = model.subscribe((newModel) => nextCallback(el, newModel));
      }
      options.onmountCallback?.();
    },
    onunmount() {
      unsub();
      unsub = null;
      options.onunmountCallback?.();
    },
  };
}

export const $text = (model: Prop<any> | Prop<any>, defaultValue: string = ''): RedomElement => reactive(model)(text(defaultValue))
  ((element, newModel) => {
    element.textContent = String(newModel);
  }) as Node;

export const $attr = (model: Prop<any>, element: RedomElement, attrGetterFn: (arg: any) => string | object): RedomElement => reactive(model)(element)
  ((element, newModel) => {
    setAttr(element, attrGetterFn(newModel));
  });

export const $style = (model: Prop<any>, element: RedomElement, styleGetterFn: (arg: any) => string | object): RedomElement => reactive(model)(element)
  ((element, newModel) => {
    setStyle(element, styleGetterFn(newModel));
  });

type KeyedModel = [ string[], Prop<any>[] ];

export const $list = (model$: Prop<any[]>, wrapper: RedomElement, keyGetterFn: (arg: any, index: number) => string, elementGetterFn: (item: any, key: string, index: number) => RedomElement): RedomElement => {
  const nodeCache: { [key: string]: RedomElement } = {},
        observableCache: { [key: string]: Prop<any> } = {};
  let previousKeys: string[] = [];

  const keyedModel: Prop<KeyedModel> = model$.map((model: any[]): KeyedModel => {
    const res: KeyedModel = [ [], [] ];
    for(let i = 0; i < model.length; i++) {
      let item = model[i];
      let key = keyGetterFn(item, i);
      let item$ = observableCache[key];
      if (item$) {
        item$.next(item);
      } else {
        item$ = useProp(item);
        observableCache[key] = item$;
      }
      res[0].push(key);
      res[1].push(item$);
    }
    for(let key of previousKeys) {
      if (res[0].indexOf(key) === -1) {
        observableCache[key]?.end();
        delete observableCache[key];
      }
    }
    return res;
  });

  return reactive(keyedModel)(wrapper)
    ((element: RedomElement, newKeyedModel: KeyedModel) => {
      if (previousKeys.length) {
        for (let key of previousKeys) {
          if (newKeyedModel[0].indexOf(key) === -1) { // previously rendered node no longer in list and needs to be removed
            let node = nodeCache[key];
            if (node) { 
              unmount(element, node);
              getEl(node).remove();
              delete nodeCache[key];
              node = null;
            }
          }
        }
      }
      let index = 0;
      let marker: Element | null = getEl(element).children[0];
      for (let key of newKeyedModel[0]) {
        let node = nodeCache[key];
        if (!node) {
          node = elementGetterFn(newKeyedModel[1][index], key, index);
          nodeCache[key] = node;
        }
        if (marker === null) { // marker reached end of children - inserting new node
          mount(element, node);
        } else if (marker === getEl(node)) { // node is already in place
          marker = marker.nextElementSibling;
        } else {
          mount(element, node, marker); // insert node before marker
        }
        index++;
      }

      previousKeys = newKeyedModel[0];
      marker = null;
    }
  );
}

export const $if = (condition: Prop<any>, thenElements: RedomElement[], elseElements?: RedomElement[]): RedomElement => {
  const marker = text('');
  let unsubscribe: Function;
  let firstMount = true;
  let unmounted = false;

  const mountThen = () => {
    if (!firstMount && elseElements) {
      unmountElements(marker, elseElements);
    }
    mountElements(marker, thenElements);
  }

  const mountElse = () => {
    if (!firstMount) {
      unmountElements(marker, thenElements);
    }
    if (elseElements) {
      mountElements(marker, elseElements);
    }
  }

  const checkCondition = (x) => {
    if (x) {
      mountThen();
    } else {
      mountElse();
    }
    firstMount = false;
  }

  return {
    el: marker,
    onmount: () => {
      if (unmounted) {
        checkCondition(condition.value);
        unmounted = false;
      }
      unsubscribe = condition.subscribe(x => {
        checkCondition(x);
      });
    },
    onunmount() {
      unmounted = true;
      unsubscribe?.();
    },
  }
}

export const $lazy = (thenFn: () => RedomElements): RedomElement => {
  const marker = text('');
  return {
    el: marker,
    onmount: () => {
      mountElements(marker, elementsArray(thenFn()));
      unmount(marker.parentNode, marker);
      marker.remove();
    }
  }
}

export const $lazySwitch = <T>(model: Prop<T>): LazySwitchBuilder<T> => {
  return new LazySwitchBuilder(model);
}

export const $lazyIf = <T>(model: Prop<T>): LazyIfBuilder<T> => {
  return new LazyIfBuilder(model);
}

export class LazySwitchBuilder<T> {
  model: Prop<T>
  el: RedomElement = text('')
  protected whenFn: ((arg: T) => boolean) | null = null
  protected defaultFn: (() => any) | null = () => []
  protected readonly conditions: [(arg: T) => any, (model: Prop<T>) => RedomElements][] = []
  protected unsubscribe: Function | null = null;
  protected cache: RedomElement[][] = [];
  protected mountedIndex: number = -1;
  protected mountedElements: RedomElement[] | null = null
  protected unmounted: boolean = false
  protected sealed: boolean = false

  constructor(model: Prop<T>) {
    this.model = model
  }

  when(whenFn: (arg: T) => boolean): LazySwitchBuilder<T> {
    if (this.sealed) {
      throw new Error('Cannot call `when` on a sealed Switch');
    }
    if (this.whenFn) {
      throw new Error('Missing `then` call for previous `when` call');
    }
    this.whenFn = whenFn
    return this
  }

  then(thenFn: () => RedomElements): LazySwitchBuilder<T> {
    if (this.sealed) {
      throw new Error('Cannot call `then` on a sealed Switch');
    }
    if (!this.whenFn) {
      throw new Error('Mising `when` call for this `then` call');
    }
    this.conditions.push([this.whenFn, thenFn])
    this.whenFn = null
    return this
  }

  default(defaultFn: () => RedomElements): LazySwitchBuilder<T> {
    if (this.sealed) {
      throw new Error('Cannot call `default` on a sealed Switch');
    }
    this.defaultFn = defaultFn
    return this
  }

  pushCondition(condition: [(arg: T) => any, () => RedomElements]): void {
    if (this.sealed) {
      throw new Error('Cannot call `pushCondition` on a sealed Switch');
    }
    this.conditions.push(condition);
  }

  onmount() {
    if (!this.sealed) {
      this.seal()
    }
    if (this.unmounted) {
      this.checkConditions(this.model.value);
      this.unmounted = false
    }
    if (!this.unsubscribe) {
      this.unsubscribe = this.model.subscribe(value => {
        this.checkConditions(value)
      })
    }
  }

  onunmount() {
    this.unmounted = true;
    this.unsubscribe?.()
    this.unsubscribe = null;
  }

  protected seal() {
    if (this.whenFn) {
      throw new Error('Missing `then` call for previous `when` call');
    }
    if (this.defaultFn) {
      this.conditions.push([
        () => true,
        this.defaultFn
      ]);
    }
    this.sealed = true
  }

  protected checkConditions(value: T) {
    const i = this.conditions.findIndex(x => x[0](value));
    if (this.mountedIndex !== i) {
      if (this.mountedIndex >= 0 && this.mountedElements?.length) {
        unmountElements(this.el, this.mountedElements);
      }
      if (i >=0) {
        this.mountedElements = this.cache[i]
        if (!this.mountedElements) {
          this.cache[i] = elementsArray(this.conditions[i][1](this.model))
          this.mountedElements = this.cache[i]
        }
        if (this.mountedElements?.length) {
          mountElements(this.el, this.mountedElements);
        }
      }
      this.mountedIndex = i;
    }
  }
}

export class LazyIfBuilder<T> extends LazySwitchBuilder<T> {
  thenFn: (() => any) | null = null
  elseFn: (() => any) | null = null

  then(thenFn: () => any): LazyIfBuilder<T> {
    if (this.thenFn) {
      throw new Error('`then` function can only be called once per If');
    }
    this.thenFn = thenFn;
    return this;
  }

  else(elseFn: () => any): LazyIfBuilder<T> {
    if (this.elseFn) {
      throw new Error('`else` function can only be called once per If');
    }
    this.elseFn = elseFn;
    return this;
  }

  when(): LazySwitchBuilder<T> {
    throw new Error('`when` is not implemented for If');
  }

  default(): LazySwitchBuilder<T> {
    throw new Error('`default` is not implemented for If');
  }

  pushCondition(): void {
    throw new Error('`pushCondition` is not implemented for If');
  }

  protected seal() {
    if (!this.thenFn && !this.elseFn) {
      throw new Error('this If has no `then` nor `else` call');
    }
    if (!this.thenFn) {
      this.thenFn = () => []
    }
    if (!this.elseFn) {
      this.elseFn = () => []
    }
    this.conditions.push([
      (val: T) => val,
      this.thenFn
    ]);
    this.conditions.push([
      (val: T) => !val,
      this.elseFn
    ]);
    this.sealed = true
  }
}

type NavigationEventDict = {
  state?: object | null,
  path?: string | null
}
export class NavigationEvent extends CustomEvent<NavigationEventDict>{}

export const $link = (props: { [key: string | symbol]: any }, ...children: RedomElement[]): RedomElement => {
  let toState: Prop<object> | object = {};
  if (props.toState) {
    toState = props.toState;
    delete props.toState;
  }

  if (!props.hasOwnProperty('href')) {
    props.href = '';
  }

  const getToStateValue = () => {
    let toStateValue = toState;
    if (toState instanceof Prop<object>) {
      return toStateValue = toState.value;
    }
    if (!isPlainObject(toStateValue)) {
      throw new Error('Router: history state must be an object, got ' + toStateValue);
    }
    return { ...window.history.state, ...toStateValue };
  }

  const handleClick = (e: Event) => {
    const path = (e.target as HTMLAnchorElement).href;
    history.pushState(getToStateValue(), '', path);
    window.dispatchEvent(new NavigationEvent('navigation', {
      detail: {
        state: getToStateValue(),
        path,
      }
    }))
    e.preventDefault();
  }

  return h('a', {
    ...props,
    mounted(el) {
      el.addEventListener('click', handleClick);
      props.mounted?.(el);
    },
    unmounted(el) {
      el.removeEventListener('click', handleClick);
      props.unmounted?.(el);
    },
  }, ...children)
}

export type InputOptions = {
  setValueProp?: string,
  getValueProp?: string,
  updateEvent?: string
  [key: string | symbol]: any,
}

const buildInput = (elementName: string, model: Prop<any>, options: InputOptions = {}): RedomElement => {
  const setValueProp = options.setValueProp || 'value';
  const getValueProp = options.getValueProp || setValueProp;
  const updateEvent = options.updateEvent || 'change';
  delete options.setValueProp;
  delete options.getValueProp;
  delete options.updateEvent;
  const onUpdate = event => {
    model.next(event.target[getValueProp])
  }
  const el = h(elementName, {
    ...options,
    [setValueProp]: model,
    mounted(el) {
      el.addEventListener(updateEvent, onUpdate);
      options.mounted?.(el);
    },
    unmounted(el) {
      el.removeEventListener(updateEvent, onUpdate);
      options.unmounted?.(el);
    }
  });
  return el;
}

export const $input = (model: Prop<any>, options: InputOptions = {}): RedomElement => {
  return buildInput('input', model, options);
}

export const $textarea = (model: Prop<any>, options: InputOptions = {}): RedomElement => {
  return buildInput('textarea', model, options);
}

export const $checkbox = (model: Prop<boolean>, options: {[key: string | symbol]: any} = {}): RedomElement => {
  return buildInput('input', model, {
    ...options,
    type: 'checkbox',
    setValueProp: 'checked',
    updateEvent: 'click',
  });
}

export type RadioOptions = {
  name: string,
  value: string,
  [key: string | symbol]: any,
}

export const $radio = (model: Prop<string>, options: RadioOptions): RedomElement => {
  if (!options.name) {
    throw new Error('Radio button must have `name` attribute!');
  }
  if (!options.value) {
    throw new Error('Radio button must have `value` attribute!');
  }
  const onClick = event => {
    model.next(event.target.value)
  }
  return h('input', {
    ...options,
    type: 'radio',
    checked: model.map(x => x === options.value),
    mounted(el) {
      el.addEventListener('click', onClick);
      options.mounted?.(el);
    },
    unmounted(el) {
      el.addEventListener('click', onClick);
      options.unmounted?.(el);
    },
  });
}