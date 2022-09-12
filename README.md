### A lightweight hotwired-compatible lib with directive programming in HTML

### Quick start example:

```html
  <div d-state="{ count: 0, displayed: true }">
    <!-- the <p> below initially shows 0 which is the value of the count var we set in d-state -->
    <p d-text="count"></p>
    <div d-show="displayed">This div will be shown while the link below was clicked odd number of times.</div>
    <a href="javascript:void(0)" d-click="{ count: count + 1, displayed: !displayed }">Clicking on this link increases the count, and toggles the div display.</a>
  </div>
```

#### How it works:
   In the above example, DRender found the div who has the 'd-state', and created a component instance with state (which from the 'd-state' attributes').
   The component compiled the directive (such as d-text, d-show) to hooks.
   All the hooks will be executed each time the state of component gets updated.

### Usage
```js
  import DRender from 'd_render'
  document.addEventListener('DOMContentLoaded',() => DRender.run())
  //Or
  //document.addEventListener('tubro:load',() => DRender.run())
```
