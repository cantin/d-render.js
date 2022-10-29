import { debug, isNil, extendObject, getAttribute, setAttribute, removeAttribute, deepMerge, findInside, isTag, parents, compileToFunc, compileWithComponent } from './util'
import { Directives } from './directives'
import DRender from './d_render'


// A component is an object contains a set of states + a set of hooks.
// Each time the state got changed, the hooks will be executed to update the UI accordingly.
//
// State is a Hash which can contain arbitrary values
//
// Hook is a Hash with a specific form. Hook is compiled from directive which attached in the HTML element.
// Hook could be either a state hook or a render hook. both of them follow the same form:
//  {
//    identifier: "The name of directive: e.g: d-model",
//    value: "the original string of directive",
//    node: "the node that directive attached to"
//    hook: "the hook function which actually executed while state changed"
//  }
// State Hooks executes right after the state got changed. Render Hookss executes on the render function.
//
// There are two ways to define a component: One by using class inheritance, the other by using function defineComponent
//
// e.g:
//   class TodoList extends DRender.Component {
//     properties...
//     methods...
//   }
//
//   defineComponent('TodoList', { ...properties }, mixin1, mixin2, ...)

class Component {
  constructor(element) {
    this.element = element
    this.renderHooks = []
    this.stateHooks = []
    this.refs = {}
    this.eventsMap = {}
    this._componentSpecificDirectives = {}

    if (getAttribute(this.element, 'd-alias')) {
      this.alias = getAttribute(this.element, 'd-alias')
      !debug.keepDirectives && removeAttribute(this.element, 'd-alias')
    }
    this.portal = getAttribute(this.element, 'd-portal-name') || this.constructor.name
    !debug.keepDirectives && removeAttribute(this.element, 'd-portal-name')

    let state = {}, str = getAttribute(element, 'd-state')
    // use return directly in case the values of state hash has ; inside
    if (str) {
      str = `
        with(this) {
          with(context) {
            return ${str}
          }
        }
      `
      state = compileToFunc('context = {}', str).bind(this)(this.context)
    }

    this.state = deepMerge({}, state)
    this.extendInstance()
    this.registerHooks()
    this.registerRefs()

    this.initialState = deepMerge({}, this.state)

  }

  // A lifecycle method for defineComponent to add mixins
  extendInstance() {
    extendComponentInstance(this, ...this.mixins())
  }

  mixins() {
    return []
  }

  addEventListener(eventIdentifier, node, handler) {
    !this.eventsMap[node] && (this.eventsMap[node] = {})
    this.eventsMap[node][eventIdentifier] = handler
    node.addEventListener(eventIdentifier, handler)
  }

  removeEventListener(eventIdentifier, node) {
    let handler = this.eventsMap[node][eventIdentifier]
    node.removeEventListener(eventIdentifier, handler)
  }

  // A lifecycle hook to run d-after-initialized directive.
  // also it's for something after component initialized like caching the parent/children
  // e.g: cache the parent and children after initializing, so that each time calling parent/children won't do the search on the DOM tree.
  // this.parent = this.parent
  // this.children = this.children
  afterInitialized() {
    this.runAfterInitializedHook()
  }

  runAfterInitializedHook() {
    let hook = 'd-after-initialized'
    const func = (node) => {
      let str = getAttribute(node, hook).trim()
      let resultFunc = compileWithComponent(str, this, 'node')
      resultFunc(node)
    }
    this.findTopLevel(`[${hook}]`).forEach(func)
  }

  // The key of context object could be direclty used in html directive.
  // e.g:
  //  given context: { outsideComponentData: 1 }
  //  in html directive, 'd-show': '{ data: outsideComponentData + 1 }'
  //
  // Note that
  // If you want modify the data('d-component-context'), always use $.extend to clone first
  // Because it's used for d-loop internally.
  // e.g:
  //   let old = this.element.dComponentContext
  //   let new = { ...old, ...updated }
  //   this.element.dComponentContext = new
  get context() {
    return this.element._dComponentContext || {}
  }

  set context(context) {
    return this.element._dComponentContext = context
  }

  set parent(parent) {
    this._parent = parent
  }

  get parent() {
    return this._parent || (parents(this.element, '[d-component], [d-state]')[0] && parents(this.element, '[d-component], [d-state]')[0]._dComponent)
  }

  set children(children) {
    this._children = children
  }

  get children() {
    if (this._children) {
      return [...this._children] //always return a new array in case someone modify the array using things like Array.prototype.reverse
    } else {
      return this.findChildrenElements({ includeElementInLoop: true }).map(e => e._dComponent)
    }
  }

  filterChildren(name) {
    return this.children.filter(c => (c.constructor.name == name) || (c.alias == name))
  }

  portalElements() {
    return document.querySelectorAll(`[d-portal="${this.portal}"]`)
  }

  findChildrenElements({ includeElementInLoop = false } = {}) {
    let arr = []
    ;[this.element, ...this.portalElements()].forEach(element => {
      arr = [...arr, ...this._findChildrenElements({ element, includeElementInLoop })]
    })
    return arr
  }

  // find the most upper children that matches [d-component] or [d-state]
  _findChildrenElements({ element, includeElementInLoop = false } = {}) {
    let descendant = null
    if (includeElementInLoop) {
      descendant = findInside(element, '[d-portal] [d-state], [d-portal] [d-component], [d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]')
    } else {
      descendant = findInside(element, '[d-portal] [d-state], [d-portal] [d-component], [d-loop] [d-state], [d-loop] [d-component], [d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]')
    }
    return findInside(element, '[d-state], [d-component]').filter((ele) => !descendant.includes(ele))
  }

  findTopLevel(selector) {
    let arr = []
    ;[this.element, ...this.portalElements()].forEach(element => {
      arr = [...arr, ...this._findTopLevel(element, selector)]
    })
    return arr
  }

  // find the most upper children that matches selector
  _findTopLevel(element, selector) {
    let descendant = findInside(element, `[d-portal] ${selector}, [d-loop] ${selector}, [d-state] ${selector}, [d-state]${selector}, [d-component] ${selector}, [d-component]${selector}`)

    let elements = findInside(element, selector).filter((ele) => !descendant.includes(ele))
    isTag(element, selector) && elements.unshift(element)

    return elements
  }

  // Assign d-ref to this.refs
  // e.g:
  //   directive d-ref: 'form' assign the current node to this.refs.form
  //
  //   d-ref: 'checkboxes[]' assign the current node to array this.refs.checkboxes
  registerRefs() {
    this.findTopLevel('[d-ref]').forEach((ele) => {
      let name = getAttribute(ele, 'd-ref')

      if (name.slice(-2) == '[]') {
        name = name.slice(0, -2)
        !this.refs[name] && (this.refs[name] = [])
        this.refs[name].push(ele)
      } else {
        this.refs[name] = ele
      }

      !debug.keepDirectives && removeAttribute(ele, 'd-ref')
    })
  }

  // A method meant to be overridden in sub-class to provide class specific directives
  componentSpecificDirectives() {
    return {}
  }

  // Iterate Directives to register hook to renderHooks and stateHooks
  registerHooks() {
    Object.entries(Directives).concat(Object.entries(this._componentSpecificDirectives))
      .concat(Object.entries(this.componentSpecificDirectives()))
      .forEach(([hook, func]) => {
      this.findTopLevel(`[${hook}]`).forEach((ele) => {
        func(this, ele)
      })
    })
  }

  transistionOnStateChanging(prevState, state) {
    prevState == state
    return {}
  }

  _mergeState(state, newState) {
    return deepMerge(state, newState)
  }

  // A function to determine whether child components should re-render or not while parent get re-rendering.
  // meant to be overridden
  shouldFollowRender(parent, transition) {
    return true
  }

  setState(state = {}, transition = {}, triggerRendering = true) {
    let prevState = this.state
    let cloned = deepMerge({}, this.state)
    let newState = typeof state == 'function' ?  state(cloned) : this._mergeState(cloned, state)

    this.state = newState
    debug.keepDirectives && setAttribute(this.element, 'd-state', JSON.stringify(newState))

    this.stateHooks.forEach(obj => obj.hook(prevState))

    transition = deepMerge(this.transistionOnStateChanging(prevState, newState), transition)
    triggerRendering && this.render(transition)

    return deepMerge({}, newState)
  }

  // transition: a temporary flag to info render to do something only once when state changes from particular value to another.
  render(transition = {}) {
    this.renderHooks.forEach(obj => obj.hook(transition))
    this.children.forEach(child => child.shouldFollowRender(this, transition) && child.render(transition))
  }

  get root() {
    let par = this.parent
    while (true) {
      if (par.parent) {
        par = par.parent
      } else {
        break
      }
    }
    return par
  }
}

const Classes = {}
const registerComponents = (...components) => {
  components.forEach(component => Classes[component.name] = component)
  DRender.observer && run() // run again only if we've run it before
}


// Define a component with multiple mixins for code re-use.
//
// Mixin could be either a object or a function.
// Mixin function will be executed with the component instance as argument while component instance get initialized.
// And its return value should be a object which will be treated as a Mixin Object.
//
// Mixin Object is a object contains arbitrary key-value pairs, which will be merged into the component instance.
// There are four specific keys: state, renderHooks, stateHooks, componentSpecificDirectives.
// Each of them will be deeply merged with or concat to the corresponding properties of the component instance.
//
// e.g:
//
// defineComponent('TodoList', (component) => {
//  let counter = 0 // a counter in console log
//
//  return {
//   // Define a state
//   state: { displayed: true },
//
//   // log the counter on rendering
//   renderHooks: [{ identifier: 'test', value: 'console.log(data)', node: null, hook: () => { console.log(data) } }),
//
//   // define a directive for this component instance
//   componentSpecificDirectives: {
//     'd-debug': (component, node) => {
//       component.renderHooks.push([{ ... }])
//     }
//   },
//
//   // A click event handler
//   handleClick() {
//     counter++
//     this.setState({ displayed: !displayed })
//   }
//  }
// })
//
const defineComponent = (name, ...objs) => {
  const nameIt = (name) => ({[name] : class extends Component {
    mixins() {
      return objs
    }
  }})[name];
  registerComponents(nameIt(name))
}

const extendComponentInstance = (component, ...objs) => {
  let computedObjs = objs.map(obj => typeof obj === 'function' ? obj(component) : obj)

  let _state = {} , _renderHooks = [], _stateHooks = [], _componentSpecificDirectives = {}
  computedObjs.forEach(obj => {
    let { state = {}, renderHooks = [], stateHooks = [], componentSpecificDirectives = {} } = obj

    deepMerge(_state, state)
    _renderHooks = _renderHooks.concat(renderHooks)
    _stateHooks = _stateHooks.concat(stateHooks)
    _componentSpecificDirectives = { ..._componentSpecificDirectives, ...componentSpecificDirectives }

    extendObject(component, obj, ['renderHooks', 'stateHooks', 'componentSpecificDirectives'])
  })

  component.state = deepMerge(component.state, _state)
  component.renderHooks = component.renderHooks.concat(_renderHooks)
  component.stateHooks = component.stateHooks.concat(_stateHooks)
  component._componentSpecificDirectives = { ...component._componentSpecificDirectives, ..._componentSpecificDirectives }
}

// Create a component isntance and attach it to the element with key 'd-component'
// The argument `context` would be stored in element data 'd-component-context', and be used for directive functions
const createComponent = (node, { context = {}, ignoreIfClassNotFound = false } = {}) => {
  if (node._dComponent != undefined) return node._dComponent

  node._dComponentContext = context

  let className = getAttribute(node, 'd-component')

  // Return if the specified class is not registered to DRender yet
  // We will back to it later while the component class is registered to DRender
  // The component must be a top level component.
  if (ignoreIfClassNotFound && !isNil(className) && !Classes[className]) {
    return null
  }

  let _class = (Classes[className] || Component), component = new _class(node)
  node._dComponent = component

  let children = component.findChildrenElements()
  children.map(child => createComponent(child, { context }))

  component.afterInitialized()

  if (!debug.keepDirectives) {
    getAttribute(node, 'd-state') && setAttribute(node, 'd-state', '')
    getAttribute(node, 'd-component') && setAttribute(node, 'd-component', '')
  }

  return component
}

export { Component, createComponent, Classes, registerComponents, defineComponent, extendComponentInstance }
