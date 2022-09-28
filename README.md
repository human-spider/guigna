
# Guigna

Guigna is a small and blazingly fast™ UI library for building reactive interfaces. It allows you to confidently work as close as possible to the DOM, providing all the conveniences you expect from a modern JS framework with none of the tradeoffs.

## Functional components
Guigna features function components that work very similarly to components in React or Vue. A component is just a function that returns a DOM element.

<details>
Here's a simple hello world component:

```jsx
  // vanilla
  import { p } from 'guigna/elements'
  const HelloWorld = () => p('Hello World!')
  // jsx
  import { jsx } from 'guigna/jsx'
  const HelloWorld = () => <p>Hello World!</p>
```
</details>

## Native Incremental DOM
Unlike many modern JS frameworks, Guigna features no Virtual DOM. Instead it uses [RE:DOM](https://redom.js.org/) coupled with a minimalistic reactive library to make explicit and precise updates to the DOM whenever state changes, while still allowing you to express reactivity in a static, declarative way. 

<details>
Here's a basic reactive component - a counter:

```jsx
import { jsx } from 'guigna/jsx'
import { useProp, t } from 'guigna'

const Counter = () => {
  const count$ = useProp(0)
  return (
    <div>
      <p>Count: {t(count$)}</p>
      <button onclick={() => { count$.value++ }}>+</button>
      <button onclick={() => { count$.value = 0 }}>Reset</button>
    </div>
  )
}
```
This looks similar to React, but under the hood it's fundamentally different. This fuction is executed only once when you call it, and it returns a real DOM node that will be directly mounted to the page. Any subsequent updates to `count$` prop will directly update the text node corresponding to the number and do nothing else. Native DOM means you can insert a `document.createElement` call as one of the elements, and it will work as expected. Even `onclick` handlers are native DOM node attributes.
</details>

## FRP simplified
Functional Reactive Programming is a very powerful paradigm, but it can also be very confusing. Full featured libraries like RXJS feature dozens of different classes and functions to learn and understand. This makes adoption harder and creates large cognitive load on the developer, while all this power is rarely needed for building simple web interfaces. Guigna features a stripped down implementation of FRP that uses just one class `Prop`. 

<details>
If you need a reactive value, wrap it in a `Prop` using the `useProp` helper.

```ts
const number$ = useProp(0);
number$.subscribe(x => console.log(x))
number$.value = 1; // prints 1
number$.set(2); // prints 2
```
</details>

## More control and less surprises
Guigna is designed to minimize hidden control flow. There is no lifecycle to speak of, and nothing will happen unless explicitly declared. Guigna features only a minimal amount of "magic" to improve productivity, and even that is strictly opt-in.

<details>
Supply a Prop as an attribute value to make it reactive.

```jsx
const disabled$ = useProp(false)
const el = <button disabled={disabled$}>Click me</button>
disabled$.value = true;
```

Now every update of `disabled$` prop will automatically update `disabled` property of the button.
</details>

## Optimized for speed and memory usage
Thanks to a minimal amount of abstractions, Guigna can render and update DOM very quickly and efficiently. Any reactivity that doesn't affect nodes currently mounted on a page is suspended, and any unneeded reactive logic can be easily disposed of. Guigna can also efficiently reuse and reorder existing nodes, allowing it to invert a list of 1000 nodes in under 30ms. Finally, you have granular control over the DOM, making it easy to optimize your own logic and helping you create performant and stable apps.