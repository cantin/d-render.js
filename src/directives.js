// Directives: a constant object to hold the hook functions. Form: { [directive string]: hook function }.
//  The hook function gets executed in Component#registerHooks.
//  Each of them registers a hook object either to the renderHooks or to the stateHooks
//  The hook function takes two arguments: component, node.
//
//  e.g: add a d-debug directive to log the state
//    Directives['d-debug'] = (component, node) => {
//    component.addStateHook('d-debug', {
//      identifier: 'd-debug',
//      value: null,
//      node,
//      hook: () => console.log(component.state)
//    })
//  }

import { generateEventFunc, generateDirectiveFunc } from './directive_helpers'
import { debug, isTag, deepMerge, compileWithComponent, getAttribute, setAttribute, removeAttribute, getData, setData } from './util'
import { createComponent } from './component'

const Directives = {
  'd-model': (component, node, directiveStr = null) => {
    let key = directiveStr || getAttribute(node, 'd-model')
    let eventFunc = null, set = null
    if (node.matches('input[type="checkbox"]')) {
      eventFunc = generateEventFunc('d-model', 'input', `{ ${key}: event.target.matches(":checked") }`)
      set = () => node.checked = component.state[key]
    } else if (node.matches('input[type="radio"]')) {
      eventFunc = generateEventFunc('d-model', 'input', `{ ${key}: event.target.value }`)
      set = () => node.checked = component.state[key] == node.value
    } else {
      eventFunc = generateEventFunc('d-model', 'input', `{ ${key}: event.target.value }`)
      set = () => node.value = component.state[key]
    }
    eventFunc(component, node)
    component.addRenderHook('d-model', {
      identifier: 'd-model',
      value: key,
      node,
      hook: set
    })
  },
  'd-loop': (component, node) => {
    // if (node.children.length != 1) {
      // throw new Error("Must only have one root element inside the d-loop.")
    // }
    const template = node.querySelector('template')

    if (!template) {
      throw new Error("Must have a template element inside the d-loop.")
    }

    const firstNode = template.content.children[0]
    let keyStr = getAttribute(firstNode, 'd-key'),
      loopStr = getAttribute(node, 'd-loop'),
      varStr = getAttribute(node, 'd-loop-var') || 'loopItem',
      loopItemKey = `${varStr}Key`, loopItem = varStr, loopItemIndex = `${varStr}Index`

    // The first child is always a d-component
    !getAttribute(firstNode, 'd-component') && setAttribute(firstNode, 'd-component', 'ShadowComponent')

    if (keyStr == undefined) {
      throw new Error("The root element inside d-loop must have d-key directive")
    }

    const loopFunc = compileWithComponent(loopStr, component)
    const keyFunc = compileWithComponent(keyStr, component, loopItemKey, loopItem, loopItemIndex)

    const iterate = (items, func) => {
      if (items.constructor == Array) {
        items.forEach((value, index) => func({ [loopItemKey]: null, [loopItem]: value, [loopItemIndex]: index }))
      } else {
        Object.entries(items).forEach(([key, value], index) => func({ [loopItemKey]: key, [loopItem]: value, [loopItemIndex]: index }))
      }
    }

    let originalNode = firstNode.cloneNode(true)
    node.innerHTML = ''
    node.appendChild(template)

    const append = (childComponentKey, context) => {
      let childNode = originalNode.cloneNode(true)
      node.appendChild(childNode)
      return createComponent(childNode, { context: { ...context, _loopComponentKey: childComponentKey, parentComponent: component }})
    }

    iterate(loopFunc(component), (context) => {
      let childComponentKey = keyFunc(...Object.values(context))
      append(childComponentKey, context)
    })

    if (!debug.keepDirectives) {
      removeAttribute(node, 'd-loop')
      removeAttribute(node, 'd-loop-var')
      for (const child of node.children) { removeAttribute(child, 'd-key') }
    }

    const loopHook = () => {
      let results = loopFunc(component)
      if (JSON.stringify(results) === node._lastLoopResults) return;
      node._lastLoopResults = JSON.stringify(results);

      let updated = {}

      let children = [...node.children].reduce((map, child) => {
        let component = child._dComponent
        if (component) {
          map[component.context._loopComponentKey] = component
        }
        return map
      }, {})

      iterate(results, (context) => {
        let childComponentKey = keyFunc(...Object.values(context))
        let childComponent = children[childComponentKey]

        if (childComponent) {
          childComponent.context = deepMerge({}, childComponent.context, context)
        } else {
          childComponent = append(childComponentKey, context)
        }
        node.appendChild(childComponent.element)
        updated[childComponentKey] = true
      })

      Object.entries(children).forEach(([k, childComponent]) => {
        (updated[k] == undefined) && childComponent.element.remove()
      })
    }

    component.addRenderHook('d-loop', {
      identifier: 'd-loop',
      value: loopStr,
      node,
      hook: loopHook
    })
  },
  'd-keyup': generateEventFunc('d-keyup', 'keyup'),
  'd-keypress': generateEventFunc('d-keypress', 'keypress'),
  'd-change': generateEventFunc('d-change', 'change'),
  'd-input': generateEventFunc('d-input', 'input'),
  'd-click': generateEventFunc('d-click', 'click'),
  'd-submit': generateEventFunc('d-submit', 'submit'),
  'd-focus': generateEventFunc('d-focus', 'focus'),
  'd-blur': generateEventFunc('d-blur', 'blur'),
  'd-show': generateDirectiveFunc('d-show', null, (node, result, _component) => {
    const shouldHide = !(!!result);
    if (node.classList.contains('d-render-hidden') !== shouldHide) {
      node.classList.toggle('d-render-hidden', shouldHide);
    }
  }),
  'd-debounce-show': generateDirectiveFunc('d-debounce-show', null, (node, result, _component) => {
    let timer = parseInt(getData(node, 'dRenderDebounceShowTimer'))
    if (!!result == true) {
      let time = getAttribute(node, 'd-debounce-duration') || 400
      timer && clearTimeout(timer);
      timer = setTimeout(() => node.classList.toggle('d-render-hidden', !(!!result)), time);
      setData(node, `dRenderDebounceShowTimer`, timer)
    } else {
      node.classList.toggle('d-render-hidden', !(!!result))
      timer && clearTimeout(timer);
    }
  }),
  'd-class': generateDirectiveFunc('d-class', 'class', (node, result, _component, originalClassName) => {
    if (typeof result == 'object') {
      Object.entries(result).forEach(([name, state]) => {
        if (node.classList.contains(name) !== !!state) {
          node.classList.toggle(name, state);
        }
      });
    } else {
      const newClassName = `${originalClassName || ''} ${result}`.trim();
      if (node.className !== newClassName) {
        node.className = newClassName;
      }
    }
  }),
  'd-debounce-class': generateDirectiveFunc('d-debounce-class', null, (node, result, _component) => {
    let timerHash = getData(node, `dRenderDebounceClass`) || {}
    Object.entries(result).forEach(([name, state]) => {
      let timer = timerHash[name]
      if (state) {
        let time = node.getAttribute('d-debounce-duration') || 400
        timer && clearTimeout(timer);
        timer = setTimeout(() => { node.classList.add(name) }, time)
        timerHash[name] = timer
      } else {
        node.classList.remove(name)
        timer && clearTimeout(timer);
      }
    })
    setData(node, 'dRenderDebounceClass', timerHash)
  }),
  'd-style': generateDirectiveFunc('d-style', null, (node, result, _component) => {
    Object.entries(result).forEach(([name, value]) => {
      if (node.style[name] !== value) {
        node.style[name] = value;
      }
    });
  }),
  'd-disabled': generateDirectiveFunc('d-disabled', null, (node, result, _component) => {
    const shouldDisable = !!result;
    if (node.disabled !== shouldDisable) {
      node.disabled = shouldDisable;
    }
  }),
  'd-readonly': generateDirectiveFunc('d-readonly', 'readonly', (node, result, _component, _originalProp) => {
    const shouldBeReadOnly = !!result;
    if (node.readOnly !== shouldBeReadOnly) {
      node.readOnly = shouldBeReadOnly;
    }
  }),
  'd-text': generateDirectiveFunc('d-text', null, (node, result, _component, _originalProp) => {
    if (isTag(node, 'input, textarea')) {
      if (node.value !== result) {
        node.value = result;
      }
    } else {
      if (node.innerText !== result) {
        node.innerText = result;
      }
    }
  }),
  'd-html': generateDirectiveFunc('d-html', null, (node, result, _component, _originalProp) => {
    if (isTag(node, 'input, textarea')) {
      if (node.value !== result) {
        node.value = result;
      }
    } else {
      if (node.innerHTML !== result) {
        node.innerHTML = result;
      }
    }
  }),
  'd-value': generateDirectiveFunc('d-value', null, (node, result, _component, _originalProp) => {
    if (node.value !== result) {
      node.value = result;
    }
  }),
  'd-prop': generateDirectiveFunc('d-prop', null, (node, result, _component, _originalProp) => {
    Object.entries(result).forEach(([name, value]) => {
      if (node[name] !== value) {
        node[name] = value;
      }
    });
  }),
  'd-attr': generateDirectiveFunc('d-attr', null, (node, result, _component, _originalProp) => {
    Object.entries(result).forEach(([name, value]) => {
      if (node.getAttribute(name) !== value) {
        node.setAttribute(name, value);
      }
    });
  }),
  'd-on-state-change': (component, node) => {
    let str = getAttribute(node, 'd-on-state-change')
    let func = compileWithComponent(str, component, 'node', 'prevState')
    component.addStateHook('d-on-state-change', {
      identifier: 'd-on-state-change',
      value: str,
      node,
      hook: (prevState) => func(node, prevState)
    })
    !debug.keepDirectives && removeAttribute(node, 'd-on-state-change')
  },
  'd-on-render': (component, node) => {
    let str = getAttribute(node, 'd-on-render')
    let func = compileWithComponent(str, component, 'node', 'transition')
    component.addRenderHook('d-on-render', {
      identifier: 'd-on-render',
      value: str,
      node,
      hook: (transition) => func(node, transition)
    })
    !debug.keepDirectives && removeAttribute(node, 'd-on-render')
  },
}

export { Directives }
