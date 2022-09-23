//let turboCompatible = true

const debug = {
  logAllFuncStr: false,
  keepDirectives: false,
  logCompiledFuncExecutionError: true,
}

const addReturnToScriptStr = (str) => {
  let arr = str.split(';')
  let last = arr[arr.length - 1]
  arr[arr.length - 1] = `return ${last}`
  return arr.join(";\n")
}

const unsafeEvalSupported = (() => {
  let unsafeEval = true
  try
  {
    const func = new Function('param1', 'param2', 'param3', 'return param1[param2] === param3;');
    unsafeEval = func({ a: 'b' }, 'a', 'b') === true;
  }
  catch (e)
  {
    unsafeEval = false;
  }
  return unsafeEval
})()

const fallbackCompileToFunc = (codeStr) => {
  var result;

  // Define callback
  window.evalCallback = (r) => result = r

  var newScript = document.createElement("script");
  var nonce = document.querySelector("meta[name=csp-nonce]").content
  newScript.setAttribute('nonce', nonce);
  newScript.innerHTML = "evalCallback(" + codeStr + ");";
  document.body.appendChild(newScript);

  // Now clean up DOM and global scope
  document.body.removeChild(newScript);
  delete window.evalCallback;
  return result;
};

// Compile string to function
// the last arguments is the string, rest of them would be arguments of the compiled function
const compileToFunc = (...args) => {
  let options = typeof args[args.length - 1] == 'object' ? args.pop() : {}
  let { addReturn = false } = options

  if (addReturn) {
    args[args.length - 1] = addReturnToScriptStr(args[args.length - 1])
  }

  if (debug.logCompiledFuncExecutionError) {
    let str = args[args.length - 1]
    let logStr = str.replaceAll('"', `\\\"`).replaceAll("\n", "\\n")
    str = `
      try {
        ${str}
      } catch (e) {
        console.log("Error occurred when executing compiled function:")
        console.log("${logStr}")
        throw e
      }
    `
    args[args.length - 1] = str
  }

  try {
    if (unsafeEvalSupported) {
      debug.logAllFuncStr && console.log("Compile string to function via 'new Function()':\n", `new Function(${args.map(e => `"${e}"`).join(", ")})`)
      return (new Function(...args))
    } else {
      let body = args.pop()
      let str = `function(${args.join(", ")}) { ${body} }`
      debug.logAllFuncStr && console.log("Compile string to function via <script>:\n", str)
      return fallbackCompileToFunc(str)
    }
  } catch (e) {
    console.log("Error occurred when compiling function from string:")
    console.log(args[args.length - 1])
    throw e
  }
}

const getDescriptor = (obj, method) => {
  let descriptor = Object.getOwnPropertyDescriptor(obj, method)
  if (descriptor) return descriptor

  let prototype = Object.getPrototypeOf(obj)
  while(true) {
    descriptor = Object.getOwnPropertyDescriptor(prototype, method)

    if (descriptor != undefined || prototype == Object.prototype) {
      break
    } else {
      prototype = Object.getPrototypeOf(prototype)
    }
  }
  return descriptor
}

// Compile str with the `with` syntax to function and bind to the component.
// If the last of args is a function, it will be invoked to transform the str before compiling.
// Convention:
//  If the str is a method name of component, the matching method of component would be returned regardless of other args.
const compileWithComponent = (str, component, ...args) => {
  let func
  let descriptor = getDescriptor(component, str)

  if (descriptor && !descriptor.get && typeof component[str] == 'function') {
    func = component[str].bind(component)
  } else {
    let transformStrFunc = args[args.length - 1]
    if (typeof transformStrFunc == 'function') {
      args.pop()
      str = transformStrFunc(str)
    } else {
      str = addReturnToScriptStr(str)
    }
    str = `
        with(this) {
          with(context) {
            with (state) {
              ${str}
            }
          }
        }
      `
    func = compileToFunc(...args, str).bind(component)
  }
  return func
}

const deepMerge = (obj, ...sources) => {
  for (let source of sources) {
    for (let key in source) {
      let value = obj[key], newValue = source[key]
      if (value && value.constructor == Object && newValue && newValue.constructor == Object) {
        obj[key] = deepMerge(value, newValue)
      } else {
        obj[key] = newValue
      }
    }
  }
  return obj
}

const getAttribute = (node, name) => node.getAttribute(name)
const setAttribute = (node, name, value) => node.setAttribute(name, value)
const removeAttribute = (node, name) => node.removeAttribute(name)
const getData = (node, name) => {
  try {
    return JSON.parse(node.dataset[name])
  } catch (e) {
    return node.dataset[name]
  }
}
const setData = (node, name, value) => node.dataset[name] = (typeof value == 'object' ? JSON.stringify(value) : value)
const emitEvent = (node, event) => node.dispatchEvent(new Event(event))

// Prepend :scope to make it works like jQuery() and jQuery.find
const findInside = (node, selector) => [...node.querySelectorAll(selector.split(",").map(se => `:scope ${se}`).join(", "))]
const querySelectorAll = selector => [...document.querySelectorAll(selector.split(",").map(se => `:scope ${se}`).join(", "))]


const parents = (node, selector) => {
  let parents = []
  let par = node.parentElement
  while (par != null) {
    isTag(par, selector) && parents.push(par)
    par = par.parentElement
  }
  return parents
}
const isTag = (node, selector) => node.matches(selector)
const isNil = (obj) => obj === undefined || obj === null

export {
  debug,
  addReturnToScriptStr,
  unsafeEvalSupported,
  fallbackCompileToFunc,
  compileToFunc,
  compileWithComponent,
  deepMerge,
  getAttribute,
  setAttribute,
  removeAttribute,
  getData,
  setData,
  emitEvent,
  findInside,
  querySelectorAll,
  parents,
  isTag,
  isNil,
}
