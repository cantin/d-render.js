// A simple lib inspired by Vue & React.
//
// A quick start example:
//
//  <div d-state="{ count: 0, displayed: true }">
//    <!-- the <p> below initially shows 0 which is the value of the count var we set in d-state -->
//    <p d-text="count"></p>
//    <div d-show="displayed">This div will show/hide while clicking on the link below.</div>
//    <a href="javascript:void(0)" d-click="{ count: count + 1, displayed: !displayed }">Clicking on this link increases the count, and toggles the div display.</a>
//  </div>
//
// How it works:
//   In the above example, d_render created a component instance and attached it to the div with 'd-state' attribute.
//   And then the component compiled the directive (such as d-text, d-show) in div and it's descendants (descendants in children components are excluded) to hooks.
//   After that the component knew how to update the DOM accordingly while the state changes.
//   Whenever a DOM element with 'd-state' or 'd-component' added or removed from DOM tree, the conresponding component will be added or removed automatically..
//
// Component is a state machine with a set of hooks.
//   State:
//     Similar with React state, a object that can contain nested arbitrary objects, use for determining the UI display.
//     Always use Component#setState to update the state. Each setState triggers a Component#render to update the UI.
//
//   Hooks in component:
//     An array of hook object. Each hook object contains a function which would be run while calling setState or render.
//     There are two kinds of hooks: stateHooks and renderHooks
//
//     stateHooks: invoked in Component#setState, used for doing something before calling render.
//     renderHooks: invoked in Component#render, used for updating the UI.
//
//   parent/children:
//     Often the UI is constructed with multiple components.
//     In order to easily access other components, d_render provides two shortcuts Component#parent and Component#children to access conresponding components.
//     Note that both shortcuts always search the DOM tree to find the DOM elements and the attached components, which make life easier on DOM elements adding/moving/removing.
//     If you concern about the performance, try caching for specific component. read Component#AfterInitialized for more details.
//
// Directive is a set of HTML custom attributes whose value compiled to function. Most of those functions will be stored as hooks in Component.
//
//   Directive Value:
//     The value of directive must be one line or multiple lines (separated by ;) of JS code, which can be compiled to JS function.
//     The `this` ref in the JS function is pointing to the current component.
//     In the JS function, you can directly use refs inside Component, Component#state and Component#context without adding prefixes.
//     e.g: given state = { count: 0 }, You can directly use "count" rather than "state.count" in the JS function.
//
//
//   List of Directives:
//     Specific Directives:
//       d-state:
//         declare the initial state of component.
//         e.g: <div d-state="{ count: 0 }"> means the component has initial state { count: 0 }
//       d-component:
//         declare custom component class for component initializing.
//         To use custom component, You first need to register the component to d_render via DRender.registerComponents
//         e.g: <div d-component="Row"> means use Row to initialize the component for this div
//
//         registerComponents(class Row extends DRender.Component {
//            // actions
//         })
//
//     Event Directives:
//       The directive value will be compiled to a JS function, and then registered to event listeners via `jQuery.on`.
//       In the JS function, you can use reference "event" to get the event object.
//
//       JS function shotcut for setState:
//         If the directive value starts with "{", then the Component#setState will be invoked, and the return value of the JS function will be used as the arguments.
//         e.g: the directive d-click: "{ count: 1 }" will be compiled to "this.setState({ count: 1})"
//
//         You can also specify the second argument `transition` of setState in the directive.
//         Transition is a temporary flag to info render to do something only once when state changes from particular value to another.
//         e.g: d-click: "{count: 1}, { startEditing: true }" is equal to setState({ count: 1}, { startCounting: true })
//
//       Prefixes:
//         Just like Vue, you can specify prefixes to the directive value to quickly done something.
//         Currently the prefixes are '.prevent', '.stop', '.debounce'.
//         To add more prefixes, see docs on Constant Prefixes and Function generatePrefixFunc below.
//
//       Currently we have these directives:
//         d-keyup, d-keypress, d-change, d-input, d-click, d-submit, d-focus, d-blur,
//
//       To add more HTML standard or custom events, see docs on Constant Directives and Function generateEventFunc below.
//
//     DOM Manipulation Directive:
//       These directives manipulate DOM base on the result of the JS function.
//       In the JS function, you can use reference "node" to get the current element, and reference `transition` to get the render transition.
//
//       d-show: Toggle class 'hidden' based on the result
//       d-debounce-show: If the result is true, debounce add the 'hidden' class, otherwise remove the 'hidden' class immediately.
//       d-class: The result must be either a hash or a string. If it's a hash, set the keys as classes based on the values (true or false), otherwise the string are appended to classes.
//       d-debounce-class: Same as the d-debounce-show but for the classes. The result must be a hash.
//       d-style: The result must be a hash. key is the style name, value is the style value.
//       d-disabled: set disabled attribute based on the result.
//       d-readonly: set readonly attribute based on the result.
//       d-text: replace element innertext with result.
//       d-html: replace element innerHTML with result.
//       d-prop: set the element properties based on the returned result hash
//
//       To add more directives, see docs on Constant Directives and Function generateDirectiveFunc
//
//     Misc Directive:
//       d-model: Same as the Vue v-model, creates two ways binding.
//       d-loop:
//         Similar to the Vue v-for.
//         The result must be an iterable, either be an array or an object.
//         e.g:
//           <div d-loop="{a: 1,b: 2, c: 3]" d-loop-var='item'>
//             <div d-key='itemKey'>
//               <p d-text='item' />
//               <p d-text='itemIndex' />
//             </div>
//           </div>
//       d-on-state-change:
//         Run JS function on state changing.
//         In the JS function you can access ref "prevState" to get the old state.
//         e.g: 'd-on-state-change': 'prevState.editing == false && editing == true ? alert('startEditing!') : nil'
//       d-on-render:
//         Run JS function on rendering
//         In the JS function you can access ref "transition" to get the render transition. check the setState and render function for more info.
//         e.g: 'd-on-render': 'transition.startEditing && this.refs.input.select()'
//       d-after-initialized:
//         Run only onnce after the component is initialized.

import { Component, createComponent, Classes, registerComponents, defineComponent, extendComponentInstance } from './component'
import { debug, emitEvent, findInside, compileToFunc, compileWithComponent, querySelectorAll } from './util'
import { Directives } from './directives'
import { generateEventFunc, generatePrefixFunc, generateDirectiveFunc, Prefixes } from './directive_helpers'

// Initialize components in view, and start the mutation observer to initialize new coming components
const run = () => {
  if (!DRender.observer) {
    function getParentWithComponentAttribute(element) {
      let currentElement = element.parentElement
      while (currentElement && currentElement !== document.body) {
        if (currentElement._dComponent) {
          return currentElement
        }
        currentElement = currentElement.parentElement;
      }
      return null; // If no parent element with the attribute is found
    }

    DRender.observer = new MutationObserver((mutationsList, _observer) => {
      for(const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          //mutation.addedNodes.forEach(node => node.nodeType == node.ELEMENT_NODE && console.log('added Node', node))
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === node.ELEMENT_NODE) {
              // console.log('added', node)
              if (node.hasAttribute('d-component') || node.hasAttribute('d-state')) {
                createComponent(node).render()
                emitEvent(node, 'd-component-initialized-from-mutation')
              } else {
                const parent = getParentWithComponentAttribute(node)
                if (parent) parent._dComponent.renewFromMutation(node)

                if (node.querySelectorAll('[d-component], [d-state]').length > 0) {
                  let descendant = findInside(node, '[d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]')
                  let top = findInside(node, '[d-state], [d-component]').filter(ele => !descendant.includes(ele))
                  top.forEach((node) => createComponent(node).render())
                  top.forEach((node) => emitEvent(node, 'd-component-initialized-from-mutation'))
                }
              }
              mutation.removedNodes.forEach((node) => {
                if (node.nodeType === node.ELEMENT_NODE) {
                  if (node.hasAttribute('d-component') || node.hasAttribute('d-state')) {
                    node._DComponent && node._DComponent.unmounted()
                  }
                  let elements = node.querySelectorAll('[d-component], [d-state]')
                  if (elements.length > 0) {
                    elements.forEach((ele) => ele._DComponent && ele._DComponent.unmounted())
                  }
                }
              })
            }
          })
        }
      }
    });
    DRender.observer.observe(document, { childList: true, subtree: true })

    const addCSS = css => document.head.appendChild(document.createElement("style")).innerHTML=css;
    addCSS(".d-render-hidden { display: none !important}")
  }

  let descendant = querySelectorAll('[d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]')
  let top = querySelectorAll('[d-state], [d-component]').filter(ele => !descendant.includes(ele))
  top.forEach((node) => {
    let component = createComponent(node, { ignoreIfClassNotFound: true })
    component && component.render()
  })
}

const DRender = {
  run,
  registerComponents,
  defineComponent,
  Classes,
  Component,
  Directives,
  Prefixes,
  createComponent,
  generateEventFunc,
  generateDirectiveFunc,
  generatePrefixFunc,
  debug,
  compileToFunc,
  compileWithComponent,
}

export default DRender
export {
  Component,
  extendComponentInstance,
  registerComponents,
  defineComponent,
}
