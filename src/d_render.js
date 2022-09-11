import { Component } from './component'
import { isNil, debug, getAttribute, setAttribute, compileToFunc, compileWithComponent, querySelectorAll } from './util'
import { Hooks } from './hooks'
import { generateEventFunc, generatePrefixFunc, generateDirectiveFunc, Prefixes } from './hook_helpers'

const Classes = {}
const registerComponents = (...components) => {
  components.forEach(component => Classes[component.name] = component)
  DRender.observer && run() // run again only if we've run it before
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
    debugger
    return null
  }

  let _class = (Classes[className] || Component), component = new _class(node)
  console.log(component)
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

// Initialize components in view, and start the mutation observer to initialize new coming components
const run = () => {
  if (!DRender.observer) {
    DRender.observer = new MutationObserver((mutationsList, _observer) => {
      for(const mutation of mutationsList) {
        if (mutation.type === 'childList') {
          //mutation.addedNodes.forEach(node => node.nodeType == node.ELEMENT_NODE && console.log('added Node', node))
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === node.ELEMENT_NODE) {
              if (node.hasAttribute('d-component') || node.hasAttribute('d-state')) {
                createComponent($(node)).render()
                emitEnvent(node, 'd-component-initialized-from-mutation')
              } else {
                if (node.querySelectorAll('[d-component], [d-state]').length > 0) {
                  let descendant = findInside(node, '[d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]')
                  let top = findInside(node, '[d-state], [d-component]').filter(ele => !descendant.includes(ele))
                  top.forEach((node) => createComponent(node).render())
                  top.forEach((node) => emitEnvent(node, 'd-component-initialized-from-mutation'))
                }
              }
            }
          })
        }
      }
    });
    DRender.observer.observe(document, { childList: true, subtree: true })
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
  Classes,
  Component,
  Hooks,
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
