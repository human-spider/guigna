import { Prop, h, $list, $if, $link, RedomElements, $lazyIf, $lazySwitch, InputOptions, $input, $textarea, $checkbox, RadioOptions, $radio, $lazy } from 'guigna';
import { RedomElement, text } from 'redom';

type SortableListProps = {
  model: Prop<any>,
  wrapper: RedomElement,
  key: (arg: any) => string,
  item: (item: any) => RedomElement
}

type IfProps = {
  model: Prop<any>
}

export const SortableList: (props: SortableListProps) => RedomElement = (props) => {
  return $list(props.model, props.wrapper, props.key, props.item);
}

export const If: (props: IfProps, ...children: RedomElement[]) => RedomElement = (props, ...children) => {
  if (children.length <= 2 && Array.isArray(children[0]) && (!children[1] || Array.isArray(children[1]))) {
    return IfElse(props, children[0], children[1]);
  }
  return $if(props.model, children);
}

export const Then = (_: any, ...children: RedomElement[]): RedomElement => {
  return children;
}

export const Else = Then;

export const IfElse = (props: IfProps, ...children: [ RedomElement[], RedomElement[]? ]): RedomElement => {
  const [ thenElements, elseElements ] = children;
  return $if(props.model, thenElements, elseElements);
}

export const Lazy = (props: { then: () => RedomElements }): RedomElement => {
  return $lazy(props.then);
}

type LazyIfProps = {
  model: Prop<any>
  then?: () => RedomElements,
  else?: () => RedomElements
}

export const LazyIf = (props: LazyIfProps): RedomElement => {
  const el = $lazyIf(props.model);
  if (props.then) {
    el.then(props.then)
  }
  if (props.else) {
    el.else(props.else);
  }
  return el;
}


type LazySwitchProps = {
  model: Prop<any>
}

type LazySwitchCase<T> = [(val: T) => boolean, (model: Prop<T>) => RedomElements]

type LazySwitchCaseProps<T> = {
  when: (val: T) => boolean,
  then: (model: Prop<T>) => RedomElements
}

export const Switch = (props: LazySwitchProps, ...children: LazySwitchCase[]): RedomElement => {
  const el = $lazySwitch(props.model);
  for (let item of children) {
    el.pushCondition(item);
  }
  return el;
}

export const Case = <T>(props: LazySwitchCaseProps<T>): LazySwitchCase<T> => {
  return [props.when, props.then];
}

export const Link = (props: { [key: string | symbol]: any }, ...children: RedomElement[]): RedomElement => {
  return $link(props, ...children);
}

type InputProps = InputOptions & {
  model: Prop<any>
}

export const Input = (props: InputProps): RedomElement => {
  const {model, ...options} = props;
  return $input(model, options);
}

export const Textarea = (props: InputProps): RedomElement => {
  const {model, ...options} = props;
  return $textarea(model, options);
}

type CheckboxProps = {
  model: Prop<any>,
  [key: string | symbol]: any
}

export const Checkbox = (props: CheckboxProps): RedomElement => {
  const {model, ...options} = props;
  return $checkbox(model, options);
}

type RadioProps = RadioOptions & {
  model: Prop<any>,
}

export const Radio = (props: RadioProps): RedomElement => {
  const {model, ...options} = props;
  return $radio(model, options);
}

export const jsx = (query, ...args) => {
  const normalizeArgs = (args) => {
    for (let i = 0; i < args.length; i++) {
      if (Array.isArray(args[i])) {
        normalizeArgs(args[i]);
      }
      if (typeof args[i] === 'string') {
        args[i] = text(args[i]);
      }
    }
  }
  // wrap text arguments into text nodes for redom
  normalizeArgs(args);

  // handle jsx fragment
  if (query === null) {
    return args;
  }

  // handle component
  if (query && typeof query === 'function') {
      return query(...args);
  }

  // handle regular element
  return h(query, ...args);
}