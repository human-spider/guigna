import { $text, isPlainObject, RedomElements } from './helpers';
import { NodeRef, Prop } from './state';
import { el, text, RedomElQuery, RedomQueryArgument, RedomElement, setAttr, setStyle } from 'redom';

const STYLE_ATTR = 'style$';
const CLASS_ATTR = 'class$';
const MOUNTED_ATTR = 'mounted';
const UNMOUNTED_ATTR = 'unmounted';
const REF_ATTR = 'ref';

interface LifecycleCallback {
  (el: Node): void
}

interface ReactiveElFn {
    (query: RedomElQuery, ...args: RedomQueryArgument[]): Element
}

export const setClass = (el: RedomElement, dict: object): void => {
  const classes = (el.getAttribute('class') || '').trim().split(/ +/)
    .reduce((res, value) => { res[value] = true; return res}, {});
  for (let key in classes) {
    if (dict.hasOwnProperty(key) && !dict[key]) {
      delete classes[key];
    }
  }
  for (let key in dict) {
    if (dict[key]) {
      classes[key] = true
    };
  }  
  el.setAttribute('class', Object.keys(classes).join(' '));
}

export const h: ReactiveElFn = (query, ...args) => {
    let reactiveAttributes: { [arg: string]: Prop<any> } = {},
        styleAttribute: Prop<object> | null = null,
        classAttribute: Prop<object> | null = null,
        refAttribute: NodeRef | null = null,
        mountedCb: LifecycleCallback | null = null,
        unmountedCb: LifecycleCallback | null = null,
        unsubscribeFns: Function[] = [];

    // process args to find special attributes
    for (let arg of args) {
      // find options object
      if(arg && isPlainObject(arg) && !arg.el && !arg.nodeType) {
        for(let x in arg as object) {
          if (String(x) === MOUNTED_ATTR && typeof arg[x] === 'function') {
            mountedCb = arg[x];
            delete arg[x];
          }
          if (String(x) === UNMOUNTED_ATTR && typeof arg[x] === 'function') {
            unmountedCb = arg[x];
            delete arg[x];
          }
          // find ref attribute - used to obtain reference to element
          if (String(x) === REF_ATTR && arg[x] instanceof NodeRef) {
            refAttribute = arg[x];
            delete arg[x];
          }
          // find style$ attribute - used to attach reactive styles to element in form of object
          if (String(x) === STYLE_ATTR && arg[x] instanceof Prop) {
            styleAttribute = arg[x];
            delete arg[x];
          }
          // find class$ attribute - used to attach reactive classes to element in form of object
          if (String(x) === CLASS_ATTR && arg[x] instanceof Prop) {
            classAttribute = arg[x];
            delete arg[x];
          }
          // find any attributes where values are props to replace with reactive attributes
          if (arg[x] instanceof Prop) {
            reactiveAttributes[x] = arg[x];
            delete arg[x];
          }
        }
      }
    }
    // create element
    let element: RedomElement = el(query, ...args);
    // attach element to ref attribute
    if (refAttribute) {
      refAttribute.value = element;
      refAttribute.end();
    }

    const result: RedomElement = {
      el: element     
    }

    const reactiveAttrKeys = Object.keys(reactiveAttributes);
    if (reactiveAttrKeys.length || styleAttribute || classAttribute) {
      result.onmount = () => {
        for (let i = 0; i < reactiveAttrKeys.length; i++) {
          // subscribe to reactive attributes and change element attributes every time they change
          const unsub = reactiveAttributes[reactiveAttrKeys[i]].subscribe(value => {
            setAttr(element, { [reactiveAttrKeys[i]]: value });
          });
          unsubscribeFns.push(unsub);
        }
        // subscribe to style attribute
        if (styleAttribute) {
          const unsub = styleAttribute.subscribe(value => {
            setStyle(element, value);
          });
          unsubscribeFns.push(unsub);
        }
        // subscribe to class attribute
        if (classAttribute) {
          const unsub = classAttribute.subscribe(value => {
            setClass(element, value);
          });
          unsubscribeFns.push(unsub);
        }
        mountedCb?.(element);
      }
      result.onunmount = () => {
        for(let i = 0; i < unsubscribeFns.length; i++) {
          unsubscribeFns[i]();
        }
        unsubscribeFns.length = 0;
        unmountedCb?.(element);
      }
    } else {
      if (mountedCb) {
        result.onmount = () => mountedCb!(element);
      }
      if (unmountedCb) {
        result.onunmount = () => unmountedCb!(element);
      }
    }
    if (!result.onmount && !result.onunmount) {
      return result.el;
    }
    return result;
  }
  
  export const t = (model: Prop<any> | TemplateStringsArray, ...args: Array<string | Prop<any>>): RedomElements => {
    // t passed a single prop - return a single reactive text node
    if (model instanceof Prop<any>) {
      return $text(model);
    }

    // t used as template literal - build array of static redom text and reactive $text nodes
    if (Array.isArray(model) && Array.isArray(args)) {
      const result: RedomElement[] = [];
      let arg;
      for (let str of model) {
        result.push(text(str));
        if (!args.length) continue;
        arg = args.shift();
        if (arg instanceof Prop<any>) {
          result.push($text(arg));
        } else {
          result.push(text(arg));
        }
      }
      return result;
    }
  }