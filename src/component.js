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
    this.renderHooks = new Map()
    this.stateHooks = new Map()
    this.eventMap = new Map()
    this._componentSpecificDirectives = {}
    this._cleanupTimeout = null

    // if (getAttribute(this.element, 'd-alias')) {
      // this.alias = getAttribute(this.element, 'd-alias')
      // !debug.keepDirectives && removeAttribute(this.element, 'd-alias')
    // }
    this.name = getAttribute(this.element, 'd-name') || this.constructor.name
    !debug.keepDirectives && removeAttribute(this.element, 'd-name')

    this.hasHooksInDescendants = getAttribute(this.element, 'd-nested-directives') || false

    let state = {}, str = getAttribute(element, 'd-state')
    // use return directly in case the values of state hash has ; inside
    if (str) {
      str = `
        let {${Object.getOwnPropertyNames(this.context)}} = this.context
        return ${str}
      `
      state = compileToFunc('context = {}', str).bind(this)(this.context)
    }

    this.state = deepMerge({}, state)
    this.extendInstance()
    this.registerHooks()
    this.hasHooksInDescendants && this.registerHooksInDescendants()

    this.initialState = deepMerge({}, this.state)
  }

  get kebabName() {
    return this.name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
  }

  convertDescendantIdentifier(identifier) {
    return identifier.replace(`d-${this.kebabName}-`, 'd-')
  }

  registerHooksInDescendants() {
    function getAttributesWithPrefix(element, prefix) {
      // Get all attributes of the element
      const attributes = Array.from(element.attributes);

      // Filter attributes that start with the specified prefix
      const matchingAttributes = attributes.filter(attr => attr.name.startsWith(prefix));

      // Create an object with attribute names and their corresponding values
      const result = {};
      matchingAttributes.forEach(attr => {
        result[attr.name] = attr.value;
      });

      return result;
    }

    this.element.querySelectorAll("*").forEach((node) => {
      const attributes = getAttributesWithPrefix(node, `d-${this.kebabName}`)

      if (Object.keys(attributes).length == 0) return

      Object.entries(attributes).forEach(([key, value]) => {
        const identifier = this.convertDescendantIdentifier(key)
        const directiveFunc = this.allDirectives()[identifier]
        directiveFunc && directiveFunc(this, node, value)
      })

      let linked = getAttribute(node, 'linked-components')
      linked = linked ? JSON.parse(linked) : []
      setAttribute(node, 'linked-components', JSON.stringify([...linked, this.kebabName]))
    })
  }

  // A lifecycle method for defineComponent to add mixins
  extendInstance() {
    extendComponentInstance(this, ...this.mixins())
  }

  mixins() {
    return []
  }

  addEventListener(identifier, event, node, handler) {
    let nodeEventMap = this.eventMap.get(node)
    if (!nodeEventMap) {
      nodeEventMap = new Map()
      this.eventMap.set(node, nodeEventMap)
    }

    // Remove existing event listener if there is one
    this.removeEventListener(identifier, node)

    nodeEventMap.set(identifier, { event, handler })
    node.addEventListener(event, handler)
  }

  removeEventListener(identifier, node) {
    const nodeEventMap = this.eventMap.get(node)
    if (nodeEventMap && nodeEventMap.has(identifier)) {
      const { event, handler } = nodeEventMap.get(identifier)
      node.removeEventListener(event, handler)
      nodeEventMap.delete(identifier)
    }
  }

  // A lifecycle hook to run cleanup code when component is unmounted (element removed from the DOM)
  unmounted() {
  }

  // A lifecycle hook to run d-after-initialized directive.
  // also it's for something after component initialized like caching the parent/children
  // e.g: cache the parent and children after initializing, so that each time calling parent/children won't do the search on the DOM tree.
  // this.parent = this.parent
  // this.children = this.children
  afterInitialized() {
    // Meant to be overridden
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
      return this.findChildrenElements({ includeElementInLoop: true }).filter(e => e._dComponent).map(e => e._dComponent)
    }
  }

  filterChildren(name) {
    return this.children.filter(c => (c.constructor.name == name) || (c.alias == name))
  }

  portalElements() {
    return document.querySelectorAll(`[d-portal="${this.name}"]`)
  }

  renewFromMutation(node) {
    // Register the hooks that are newly added to the DOM
    const hooksChanged = this.registerHooks(node)

    this.debouncedCleanupRemovedNodes()

    hooksChanged && this.render()
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

  findTopLevel(selector, scopeElement) {
    let arr = []
    const elements = scopeElement ? [scopeElement] : [this.element, ...this.portalElements()]
    elements.forEach(element => {
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


  // Dynamically get refs from the current component instance
  // e.g:
  //   directive d-ref: 'form' assign the current node to this.refs.form
  //
  //   d-ref: 'checkboxes[]' assign the current node to array this.refs.checkboxes
  get refs() {
    return this.findRefs()
  }

  findRefs() {
    const refs = []

    this.findTopLevel('[d-ref]').forEach((ele) => {
      let name = getAttribute(ele, 'd-ref')

      if (name.slice(-2) == '[]') {
        name = name.slice(0, -2)
        !refs[name] && (refs[name] = [])
        refs[name].push(ele)
      } else {
        refs[name] = ele
      }
    })

    this.element.querySelectorAll(`[d-${this.kebabName}-ref]`).forEach((ele) => {
      let name = getAttribute(ele, `d-${this.kebabName}-ref`)

      if (name.slice(-2) == '[]') {
        name = name.slice(0, -2)
        !refs[name] && (refs[name] = [])
        refs[name].push(ele)
      } else {
        refs[name] = ele
      }
    })

    return refs
  }

  // A method meant to be overridden in sub-class to provide class specific directives
  componentSpecificDirectives() {
    return {}
  }

  allDirectives() {
    return Object.assign({}, Directives, this._componentSpecificDirectives, this.componentSpecificDirectives())
    // return Object.entries(Directives).concat(Object.entries())
      // .concat(Object.entries(this.componentSpecificDirectives()))
  }

  // Iterate Directives to register hook to renderHooks and stateHooks
  registerHooks(scopeNode = undefined) {
    let updated = false
      Object.entries(this.allDirectives()).forEach(([hook, func]) => {
      this.findTopLevel(`[${hook}]`, scopeNode).forEach((ele) => {
        updated = true
        func(this, ele)
      })
    })
    return updated
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

    if (this._insideStateChanging) return

    this.insideStateChanging(() => this.stateHooks.forEach((nodeHooks, _node) => {
      nodeHooks.forEach(hook => hook.hook(prevState))
    }))

    cloned = deepMerge({}, this.state)
    debug.keepDirectives && setAttribute(this.element, 'd-state', JSON.stringify(cloned))

    transition = deepMerge(this.transistionOnStateChanging(prevState, cloned), transition)
    triggerRendering && this.render(transition)

    return cloned
  }

  insideStateChanging(func) {
    try {
      this._insideStateChanging = true
      func()
    } finally {
      this._insideStateChanging = false
    }
  }

  // transition: a temporary flag to info render to do something only once when state changes from particular value to another.
  render(transition = {}) {
    this.renderHooks.forEach((nodeHooks, _node) => {
      nodeHooks.forEach(hook => hook.hook(transition))
    })
    this.children.forEach(child => child.shouldFollowRender(this, transition) && child.render(transition))
  }

  debouncedRender() {
    this._renderTimeout && clearTimeout(this._renderTimeout)
    this._renderTimeout = setTimeout(() => {
      this.render()
      this._renderTimeout = null
    }, 100)
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

  updateHook(identifier, node, inDescendant = false) {
    const originalIdentifier = identifier

    if (inDescendant) {
      identifier = this.convertDescendantIdentifier(identifier)
    }

    // Remove existing hooks for this attribute and node
    let nodeStateHooks = this.stateHooks.get(node)
    let nodeRenderHooks = this.renderHooks.get(node)

    if (nodeStateHooks) {
      nodeStateHooks.delete(identifier)
    }

    if (nodeRenderHooks) {
      nodeRenderHooks.delete(identifier)
    }

    // Remove existing event listener if it exists
    this.removeEventListener(identifier, node)


    // If the attribute exists, add new hook or event listener
    if (node.hasAttribute(originalIdentifier)) {
      let directiveFunc = this.allDirectives()[identifier]
      if (directiveFunc) {
        if (inDescendant) {
          directiveFunc(this, node, getAttribute(node, originalIdentifier))
        } else {
          directiveFunc(this, node)
        }
      }
    }

    this.deboundedHookUpdated(this.render.bind(this))
  }


  // Called after initializing the component and hooks are updated
  hookUpdated() {
    // meant to be overridden
  }

  addRenderHook(identifier, hook) {
    let nodeHooks = this.renderHooks.get(hook.node)
    if (!nodeHooks) {
      nodeHooks = new Map()
      this.renderHooks.set(hook.node, nodeHooks)
    }
    nodeHooks.set(identifier, hook)
  }

  addStateHook(identifier, hook) {
    let nodeHooks = this.stateHooks.get(hook.node)
    if (!nodeHooks) {
      nodeHooks = new Map()
      this.stateHooks.set(hook.node, nodeHooks)
    }
    nodeHooks.set(identifier, hook)
  }

  cleanupRemovedNodes() {
    const elements = [this.element, ...this.portalElements()]

    ;[this.renderHooks, this.stateHooks, this.eventMap].forEach(map => {
      for (let [node, _hooks] of map) {
        if (!elements.some(ele => ele.contains(node))) {
          map.delete(node)
        }
      }
    })
  }

  debouncedCleanupRemovedNodes() {
    if (this._cleanupTimeout) {
      clearTimeout(this._cleanupTimeout)
    }
    this._cleanupTimeout = setTimeout(() => {
      this.cleanupRemovedNodes()
      this._cleanupTimeout = null
    }, 100)
  }

  deboundedHookUpdated(func) {
    if (this._hookUpdatedTimeout) {
      clearTimeout(this._hookUpdatedTimeout);
    }
    this._hookUpdatedTimeout = setTimeout(() => {
      this.hookUpdated()
      func && func()
      this._hookUpdatedTimeout = null
    }, 50);
  }
}

const proxyToParent = (Class) => {
  return new Proxy(Class, {
    get(obj, prop) {
      if (Reflect.has(obj, prop)) {
        return Reflect.get(obj, prop)
      } else {
        return Reflect.get(obj.parent, prop)
      }
    }
  })
}

// ShadowComponent is used as the default component for d-loop
// delegates everything to the parent, so that we may use
// setState({ stateInParent: updates }) without prefix `this.parent`
export class ShadowComponent extends Component {
  constructor(element) {
    super(element)
    return proxyToParent(this)
  }

  get state() {
    return this.parent ? this.parent.state : this.context.parentComponent.state
  }

  set state(state) {
    return {}
  }

  setState(...args) {
    return this.parent.setState(...args)
  }
}

const Classes = { Component, ShadowComponent }
const registerComponents = (...components) => {
  components.forEach(component => Classes[component.name] = component)
  DRender.observer && DRender.run() // run again only if we've run it before
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
  }})[name]
  registerComponents(nameIt(name))
}

const extendComponentInstance = (component, ...objs) => {
  let computedObjs = objs.map(obj => typeof obj === 'function' ? obj(component) : obj)

  let _state = {}, _componentSpecificDirectives = {}
  computedObjs.forEach(obj => {
    let { state = {}, renderHooks = new Map(), stateHooks = new Map(), componentSpecificDirectives = {} } = obj

    deepMerge(_state, state)

    // Merge renderHooks
    renderHooks.forEach((value, key) => {
      if (!component.renderHooks.has(key)) {
        component.renderHooks.set(key, new Map())
      }
      value.forEach((hookValue, hookKey) => {
        component.renderHooks.get(key).set(hookKey, hookValue)
      })
    })

    // Merge stateHooks
    stateHooks.forEach((value, key) => {
      if (!component.stateHooks.has(key)) {
        component.stateHooks.set(key, new Map())
      }
      value.forEach((hookValue, hookKey) => {
        component.stateHooks.get(key).set(hookKey, hookValue)
      })
    })

    _componentSpecificDirectives = { ..._componentSpecificDirectives, ...componentSpecificDirectives }

    extendObject(component, obj, ['renderHooks', 'stateHooks', 'componentSpecificDirectives'])
  })

  component.state = deepMerge(component.state, _state)
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

  component.runAfterInitializedHook()
  component.afterInitialized()
  component.hookUpdated()

  if (!debug.keepDirectives) {
    getAttribute(node, 'd-state') && setAttribute(node, 'd-state', '')
    getAttribute(node, 'd-component') && setAttribute(node, 'd-component', '')
  }

  return component
}

export { Component, createComponent, Classes, registerComponents, defineComponent, extendComponentInstance }
