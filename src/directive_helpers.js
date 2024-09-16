import { debug, getAttribute, removeAttribute, setAttribute, compileWithComponent } from './util'

//Split and Collect Prefixes from the str
//e.g:
//  given the string below
//    ".prevent.stop { updating: true }
//returns ["{ updating: true }", [".prevent", ".stop"]]
const collectPrefixes = (str) => {
  let prefixes = str.match(/^\.[^\s]+\s/)
  if (prefixes) {
    prefixes = prefixes[0].substring(1).split('.').map(prefix => `.${prefix}`.trim() )
    str = str.replace(/^\.[^\s]+\s/, '')
  }
  return [str, prefixes]
}

// This function returns a function that stored in Hooks and invoked in Component#registerHooks()
// When the returned function gets invoked:
//  It compiles the directive value to a handler function. And then registers the handler to event listener.
//  Convention:
//    If the directive value starts with "{", transform to "this.setState(${originalStr})" before compiling.
//    If preDefinedStr is present, use it to compile the handle function.
const generateEventFunc = (identifier, event, preDefinedStr = null) => {
  return (component, node) => {
    let originalStr = preDefinedStr ? preDefinedStr.trim() : getAttribute(node, identifier).trim()
    let [str, prefixes] = collectPrefixes(originalStr)

    let handler = compileWithComponent(str, component, 'event', (str) => str[0] == '{' ? `this.setState(${str})` : str)
    prefixes && prefixes.forEach((prefix) => {
      handler = Prefixes[prefix] ? Prefixes[prefix](handler, component, node, prefixes) : handler
    })

    component.addEventListener(identifier, event, node, handler)
    !debug.keepDirectives && removeAttribute(node, identifier)
  }
}

// This function returns a function that invoked in generateDirectiveFunc
// Similar with Redux#compose, When the returned function gets invoked:
//  It returns another function with handler function as argument to be able to chaining.
const generatePrefixFunc = (func) => {
  return (handler, component, node, prefixes) => {
    return (event) => {
      func(handler, event, component, node, prefixes)
    }
  }
}

// This function returns a function that stored in Hooks
// When the returned function gets invoked:
//  It compiles the directive value to a result function.
//  It pushes a hook object with the callback function to Component#renderHooks
//  When the hook gets invoked, the callback function updates DOM accordingly based on the return value of the result function.
const generateDirectiveFunc = (identifier, prop, callbackFunc) => {
  return (component, node) => {
    let originalProp = prop ? getAttribute(node, prop) : null
    let str = getAttribute(node, identifier).trim()
    let resultFunc = compileWithComponent(str, component, 'node', 'transition')

    !debug.keepDirectives && removeAttribute(node, identifier)
    component.addRenderHook(identifier, {
      identifier,
      value: str,
      node,
      hook: (transition) => callbackFunc(node, resultFunc(node, transition), component, originalProp)
    })
  }
}

// Prefixes: a constant object to hold the prefix functions. Form: { [prefix string]: prefix function }.
// The prefix function gets executed when the prefix string matched in generateEventFunc.
//  It takes four arguments: handler, component, node, prefixes, and returns a function which gets invoked in the event listener.
//  handler: the chaining handler function, called to run other handlers.
//
// e.g: register a 'esc' prefix to handle esc pressing.
//   Prefixes['.esc'] = (handler, component, node, prefixes) => {
//     return (event) => {
//       if (event.type == 'keyup' && event.key == 'esc') {
//          event.preventDefault()
//          // do something special for esc pressing, like compiling the directive value to function and run it
//       } else {
//         handler() //not pressing esc, do nothing and pass to the next handler.
//       }
//     }
//   }
const Prefixes = {
  '.prevent': generatePrefixFunc((handler, event, _component, _node, _prefixes) => {
    event.preventDefault()
    handler(event)
  }),
  '.stop': generatePrefixFunc((handler, event, _component, _node, _prefixes) => {
    event.stopPropagation()
    handler(event)
  }),
  '.debounce': generatePrefixFunc((handler, event, _component, node, _prefixes) => {
    let time = getAttribute(node, 'd-debounce-duration') || 400
    let timer = parseInt(getData(node, `drender-${event.type}-debounce`))
    timer && clearTimeout(timer)
    timer = setTimeout(() => handler(event), time)
    setData(node, `drender-${event.type}-debounce`, timer)
  }),
}

export {
  collectPrefixes,
  generateEventFunc,
  generatePrefixFunc,
  generateDirectiveFunc,
  Prefixes,
}

