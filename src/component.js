import { debug, isNil, getAttribute, setAttribute, removeAttribute, deepMerge, findInside, isTag, parents, compileToFunc, compileWithComponent } from './util'
import { Hooks } from './hooks'
import DRender from './d_render'

class Component {
  constructor(element) {
    this.element = element
    this.renderHooks = []
    this.stateHooks = []
    this.refs = {}
    this.eventsMap = {}

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
    this.initialState = deepMerge({}, this.state)

    this.registerHooks()
    this.registerRefs()
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

  // find the most upper children that matches [d-component] or [d-state]
  findChildrenElements({ includeElementInLoop = false } = {}) {
    let descendant = null
    if (includeElementInLoop) {
      descendant = findInside(this.element, '[d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]')
    } else {
      descendant = findInside(this.element, '[d-loop] [d-state], [d-loop] [d-component], [d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]')
    }
    return findInside(this.element, '[d-state], [d-component]').filter((ele) => !descendant.includes(ele))
  }

  // find the most upper children that matches selector
  findTopLevel(selector) {
    let descendant
    if (selector == '[d-loop]') {
      descendant = findInside(this.element, `[d-loop] ${selector}, [d-state] ${selector}, [d-state]${selector}, [d-component] ${selector}, [d-component]${selector}`)
    } else {
      descendant = findInside(this.element, `[d-loop] ${selector}, [d-loop]${selector}, [d-state] ${selector}, [d-state]${selector}, [d-component] ${selector}, [d-component]${selector}`)
    }

    let elements = findInside(this.element, selector).filter((ele) => !descendant.includes(ele))
    isTag(this.element, selector) && elements.unshift(this.element)

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

  // A method meant to be overridden in sub-class to provide class specific hooks
  classSpecificHooks() {
    return {}
  }

  // Iterate Hooks to register hook to renderHooks and stateHooks
  registerHooks() {
    Object.entries(Hooks).concat(Object.entries(this.classSpecificHooks())).forEach(([hook, func]) => {
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

const defineComponent = (name, component) => {
  const nameIt = (name) => ({[name] : class extends Component {}})[name];
  const klass = nameIt(name)
  Object.assign(klass.prototype, component)
  registerComponents(klass)
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

export { Component, createComponent, Classes, registerComponents, defineComponent }
