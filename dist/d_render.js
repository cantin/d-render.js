// src/util.js
var debug = {
  logAllFuncStr: false,
  keepDirectives: true,
  logCompiledFuncExecutionError: true,
  logAttributeChanges: false
};
var addReturnToScriptStr = (str) => {
  let arr = str.split(";");
  let last = arr[arr.length - 1];
  arr[arr.length - 1] = `return ${last}`;
  return arr.join(";\n");
};
var unsafeEvalSupported = (() => {
  let unsafeEval = true;
  try {
    const func = new Function("param1", "param2", "param3", "return param1[param2] === param3;");
    unsafeEval = func({ a: "b" }, "a", "b") === true;
  } catch (e) {
    unsafeEval = false;
  }
  return unsafeEval;
})();
var fallbackCompileToFunc = (codeStr) => {
  var result;
  window.evalCallback = (r) => result = r;
  var newScript = document.createElement("script");
  var nonce = document.querySelector("meta[name=csp-nonce]").content;
  newScript.setAttribute("nonce", nonce);
  newScript.innerHTML = "evalCallback(" + codeStr + ");";
  document.body.appendChild(newScript);
  document.body.removeChild(newScript);
  delete window.evalCallback;
  return result;
};
var compileToFunc = (...args) => {
  let options = typeof args[args.length - 1] == "object" ? args.pop() : {};
  let { addReturn = false } = options;
  if (addReturn) {
    args[args.length - 1] = addReturnToScriptStr(args[args.length - 1]);
  }
  if (debug.logCompiledFuncExecutionError) {
    let str = args[args.length - 1];
    let logStr = JSON.stringify({ functionLiteral: str });
    str = `
      try {
        ${str}
      } catch (e) {
        console.log("Error occurred when executing compiled function:")
        console.log(${logStr})
        throw e
      }
    `;
    args[args.length - 1] = str;
  }
  try {
    if (unsafeEvalSupported) {
      debug.logAllFuncStr && console.log("Compile string to function via 'new Function()':\n", `new Function(${args.map((e) => `"${e}"`).join(", ")})`);
      return new Function(...args);
    } else {
      let body = args.pop();
      let str = `function(${args.join(", ")}) { ${body} }`;
      debug.logAllFuncStr && console.log("Compile string to function via <script>:\n", str);
      return fallbackCompileToFunc(str);
    }
  } catch (e) {
    console.log("Error occurred when compiling function from string:");
    console.log(args[args.length - 1]);
    throw e;
  }
};
var getDescriptor = (obj, method) => {
  let descriptor = Object.getOwnPropertyDescriptor(obj, method);
  if (descriptor)
    return descriptor;
  let prototype = Object.getPrototypeOf(obj);
  while (true) {
    descriptor = Object.getOwnPropertyDescriptor(prototype, method);
    if (descriptor != void 0 || prototype == Object.prototype) {
      break;
    } else {
      prototype = Object.getPrototypeOf(prototype);
    }
  }
  return descriptor;
};
var compileWithComponent = (str, component, ...args) => {
  let func;
  let descriptor = getDescriptor(component, str);
  if (descriptor && !descriptor.get && typeof component[str] == "function") {
    func = component[str].bind(component);
  } else {
    let transformStrFunc = args[args.length - 1];
    if (typeof transformStrFunc == "function") {
      args.pop();
      str = transformStrFunc(str);
    } else {
      str = addReturnToScriptStr(str);
    }
    let words = unique(getWords(str));
    let properties = getProperties(component);
    let used = words.filter((word) => properties.includes(word));
    str = `
        let {${used}} = this;
        ${used.map((prop) => `if (typeof ${prop} == 'function') ${prop} = ${prop}.bind(this);`).join("\n")}
        let {${Object.getOwnPropertyNames(component.context)}} = this.context;
        let {${Object.getOwnPropertyNames(component.state)}} = this.state;
        ${str}
      `;
    func = compileToFunc(...args, str).bind(component);
  }
  return func;
};
var unique = (arr) => arr.filter((v, i, a) => a.indexOf(v) === i);
var getWords = (str) => {
  let arr = [];
  let regex = /\w+/g;
  let match;
  while ((match = regex.exec(str)) !== null) {
    arr.push(match[0]);
  }
  return arr;
};
var getProperties = (obj) => {
  let properties = /* @__PURE__ */ new Set();
  let currentObj = obj;
  do {
    Object.getOwnPropertyNames(currentObj).map((item) => properties.add(item));
  } while (currentObj = Object.getPrototypeOf(currentObj));
  return [...properties];
};
var deepMerge = (obj, ...sources) => {
  for (let source of sources) {
    for (let key in source) {
      let value = obj[key], newValue = source[key];
      if (value && value.constructor == Object && newValue && newValue.constructor == Object) {
        obj[key] = deepMerge(value, newValue);
      } else {
        obj[key] = newValue;
      }
    }
  }
  return obj;
};
var getAttribute = (node, name) => node.getAttribute(name);
var setAttribute = (node, name, value) => node.setAttribute(name, value);
var removeAttribute = (node, name) => node.removeAttribute(name);
var getData2 = (node, name) => {
  try {
    return JSON.parse(node.dataset[name]);
  } catch (e) {
    return node.dataset[name];
  }
};
var setData2 = (node, name, value) => node.dataset[name] = typeof value == "object" ? JSON.stringify(value) : value;
var emitEvent = (node, event) => node.dispatchEvent(new Event(event, { bubbles: true }));
var findInside = (node, selector) => [...node.querySelectorAll(selector.split(",").map((se) => `:scope ${se}`).join(", "))];
var querySelectorAll = (selector) => [...document.querySelectorAll(selector.split(",").map((se) => `:scope ${se}`).join(", "))];
var parents = (node, selector) => {
  let parents2 = [];
  let par = node.parentElement;
  while (par != null) {
    isTag(par, selector) && parents2.push(par);
    par = par.parentElement;
  }
  return parents2;
};
var isTag = (node, selector) => node.matches(selector);
var isNil = (obj) => obj === void 0 || obj === null;
var extendObject = (source, obj, excludedKeys = []) => {
  Object.entries(Object.getOwnPropertyDescriptors(obj)).forEach(([k, property]) => {
    if (property.get || property.set) {
      Object.defineProperty(source, k, { get: property.get, set: property.set });
    } else {
      Object.defineProperty(source, k, property);
    }
  });
};

// src/directive_helpers.js
var collectPrefixes = (str) => {
  let prefixes = str.match(/^\.[^\s]+\s/);
  if (prefixes) {
    prefixes = prefixes[0].substring(1).split(".").map((prefix) => `.${prefix}`.trim());
    str = str.replace(/^\.[^\s]+\s/, "");
  }
  return [str, prefixes];
};
var generateEventFunc = (identifier, event, preDefinedStr = null) => {
  return (component, node, directiveStr = null) => {
    let originalStr = preDefinedStr ? preDefinedStr.trim() : directiveStr ? directiveStr : getAttribute(node, identifier).trim();
    let [str, prefixes] = collectPrefixes(originalStr);
    let handler = compileWithComponent(str, component, "event", (str2) => str2[0] == "{" ? `this.setState(${str2})` : str2);
    prefixes && prefixes.forEach((prefix) => {
      handler = Prefixes[prefix] ? Prefixes[prefix](handler, component, node, prefixes) : handler;
    });
    component.addEventListener(identifier, event, node, handler);
    !debug.keepDirectives && removeAttribute(node, identifier);
  };
};
var generatePrefixFunc = (func) => {
  return (handler, component, node, prefixes) => {
    return (event) => {
      func(handler, event, component, node, prefixes);
    };
  };
};
var generateDirectiveFunc = (identifier, prop, callbackFunc) => {
  return (component, node, directiveStr = null) => {
    let originalProp = prop ? getAttribute(node, prop) : null;
    let str = directiveStr || getAttribute(node, identifier).trim();
    let resultFunc = compileWithComponent(str, component, "node", "transition");
    component.addRenderHook(identifier, {
      identifier,
      value: str,
      node,
      hook: (transition) => callbackFunc(node, resultFunc(node, transition), component, originalProp)
    });
  };
};
var Prefixes = {
  ".prevent": generatePrefixFunc((handler, event, _component, _node, _prefixes) => {
    event.preventDefault();
    handler(event);
  }),
  ".stop": generatePrefixFunc((handler, event, _component, _node, _prefixes) => {
    event.stopPropagation();
    handler(event);
  }),
  ".debounce": generatePrefixFunc((handler, event, _component, node, _prefixes) => {
    let time = getAttribute(node, "d-debounce-duration") || 400;
    let timer = parseInt(getData(node, `drender-${event.type}-debounce`));
    timer && clearTimeout(timer);
    timer = setTimeout(() => handler(event), time);
    setData(node, `drender-${event.type}-debounce`, timer);
  })
};

// src/directives.js
var Directives = {
  "d-model": (component, node, directiveStr = null) => {
    let key = directiveStr || getAttribute(node, "d-model");
    let eventFunc = null, set = null;
    if (node.matches('input[type="checkbox"]')) {
      eventFunc = generateEventFunc("d-model", "input", `{ ${key}: event.target.matches(":checked") }`);
      set = () => node.checked = component.state[key];
    } else {
      eventFunc = generateEventFunc("d-model", "input", `{ ${key}: event.target.value }`);
      set = () => node.value = component.state[key];
    }
    eventFunc(component, node);
    component.addRenderHook("d-model", {
      identifier: "d-model",
      value: key,
      node,
      hook: set
    });
  },
  "d-loop": (component, node) => {
    if (node.children.length != 1) {
      throw new Error("Must only have one root element inside the d-loop.");
    }
    let keyStr = getAttribute(node.children[0], "d-key"), loopStr = getAttribute(node, "d-loop"), varStr = getAttribute(node, "d-loop-var") || "loopItem", loopItemKey = `${varStr}Key`, loopItem = varStr, loopItemIndex = `${varStr}Index`;
    !getAttribute(node.children[0], "d-component") && setAttribute(node.children[0], "d-component", "ShadowComponent");
    if (keyStr == void 0) {
      throw new Error("The root element inside d-loop must have d-key directive");
    }
    const loopFunc = compileWithComponent(loopStr, component);
    const keyFunc = compileWithComponent(keyStr, component, loopItemKey, loopItem, loopItemIndex);
    const iterate = (items, func) => {
      if (items.constructor == Array) {
        items.forEach((value, index) => func({ [loopItemKey]: null, [loopItem]: value, [loopItemIndex]: index }));
      } else {
        Object.entries(items).forEach(([key, value], index) => func({ [loopItemKey]: key, [loopItem]: value, [loopItemIndex]: index }));
      }
    };
    let originalNode = node.children[0].cloneNode(true);
    node.innerHTML = "";
    const append = (childComponentKey, context) => {
      let childNode = originalNode.cloneNode(true);
      node.appendChild(childNode);
      return createComponent(childNode, { context: { ...context, _loopComponentKey: childComponentKey, parentComponent: component } });
    };
    iterate(loopFunc(component), (context) => {
      let childComponentKey = keyFunc(...Object.values(context));
      append(childComponentKey, context);
    });
    if (!debug.keepDirectives) {
      removeAttribute(node, "d-loop");
      removeAttribute(node, "d-loop-var");
      for (const child of node.children) {
        removeAttribute(child, "d-key");
      }
    }
    const loopHook = () => {
      let results = loopFunc(component);
      if (JSON.stringify(results) === node._lastLoopResults)
        return;
      node._lastLoopResults = JSON.stringify(results);
      let updated = {};
      let children = [...node.children].reduce((map, child) => {
        let component2 = child._dComponent;
        map[component2.context._loopComponentKey] = component2;
        return map;
      }, {});
      iterate(results, (context) => {
        let childComponentKey = keyFunc(...Object.values(context));
        let childComponent = children[childComponentKey];
        if (childComponent) {
          childComponent.context = deepMerge({}, childComponent.context, context);
        } else {
          childComponent = append(childComponentKey, context);
        }
        node.appendChild(childComponent.element);
        updated[childComponentKey] = true;
      });
      Object.entries(children).forEach(([k, childComponent]) => {
        updated[k] == void 0 && childComponent.element.remove();
      });
    };
    component.addRenderHook("d-loop", {
      identifier: "d-loop",
      value: loopStr,
      node,
      hook: loopHook
    });
  },
  "d-keyup": generateEventFunc("d-keyup", "keyup"),
  "d-keypress": generateEventFunc("d-keypress", "keypress"),
  "d-change": generateEventFunc("d-change", "change"),
  "d-input": generateEventFunc("d-input", "input"),
  "d-click": generateEventFunc("d-click", "click"),
  "d-submit": generateEventFunc("d-submit", "submit"),
  "d-focus": generateEventFunc("d-focus", "focus"),
  "d-blur": generateEventFunc("d-blur", "blur"),
  "d-show": generateDirectiveFunc("d-show", null, (node, result, _component) => {
    const shouldHide = !!!result;
    if (node.classList.contains("d-render-hidden") !== shouldHide) {
      node.classList.toggle("d-render-hidden", shouldHide);
    }
  }),
  "d-debounce-show": generateDirectiveFunc("d-debounce-show", null, (node, result, _component) => {
    let timer = parseInt(getData2(node, "dRenderDebounceShowTimer"));
    if (!!result == true) {
      let time = getAttribute(node, "d-debounce-duration") || 400;
      timer && clearTimeout(timer);
      timer = setTimeout(() => node.classList.toggle("d-render-hidden", !!!result), time);
      setData2(node, `dRenderDebounceShowTimer`, timer);
    } else {
      node.classList.toggle("d-render-hidden", !!!result);
      timer && clearTimeout(timer);
    }
  }),
  "d-class": generateDirectiveFunc("d-class", "class", (node, result, _component, originalClassName) => {
    if (typeof result == "object") {
      Object.entries(result).forEach(([name, state]) => {
        if (node.classList.contains(name) !== !!state) {
          node.classList.toggle(name, state);
        }
      });
    } else {
      const newClassName = `${originalClassName || ""} ${result}`.trim();
      if (node.className !== newClassName) {
        node.className = newClassName;
      }
    }
  }),
  "d-debounce-class": generateDirectiveFunc("d-debounce-class", null, (node, result, _component) => {
    let timerHash = getData2(node, `dRenderDebounceClass`) || {};
    Object.entries(result).forEach(([name, state]) => {
      let timer = timerHash[name];
      if (state) {
        let time = node.getAttribute("d-debounce-duration") || 400;
        timer && clearTimeout(timer);
        timer = setTimeout(() => {
          node.classList.add(name);
        }, time);
        timerHash[name] = timer;
      } else {
        node.classList.remove(name);
        timer && clearTimeout(timer);
      }
    });
    setData2(node, "dRenderDebounceClass", timerHash);
  }),
  "d-style": generateDirectiveFunc("d-style", null, (node, result, _component) => {
    Object.entries(result).forEach(([name, value]) => {
      if (node.style[name] !== value) {
        node.style[name] = value;
      }
    });
  }),
  "d-disabled": generateDirectiveFunc("d-disabled", null, (node, result, _component) => {
    const shouldDisable = !!result;
    if (node.disabled !== shouldDisable) {
      node.disabled = shouldDisable;
    }
  }),
  "d-readonly": generateDirectiveFunc("d-readonly", "readonly", (node, result, _component, _originalProp) => {
    const shouldBeReadOnly = !!result;
    if (node.readOnly !== shouldBeReadOnly) {
      node.readOnly = shouldBeReadOnly;
    }
  }),
  "d-text": generateDirectiveFunc("d-text", null, (node, result, _component, _originalProp) => {
    if (isTag(node, "input, textarea")) {
      if (node.value !== result) {
        node.value = result;
      }
    } else {
      if (node.innerText !== result) {
        node.innerText = result;
      }
    }
  }),
  "d-html": generateDirectiveFunc("d-html", null, (node, result, _component, _originalProp) => {
    if (isTag(node, "input, textarea")) {
      if (node.value !== result) {
        node.value = result;
      }
    } else {
      if (node.innerHTML !== result) {
        node.innerHTML = result;
      }
    }
  }),
  "d-value": generateDirectiveFunc("d-value", null, (node, result, _component, _originalProp) => {
    if (node.value !== result) {
      node.value = result;
    }
  }),
  "d-prop": generateDirectiveFunc("d-prop", null, (node, result, _component, _originalProp) => {
    Object.entries(result).forEach(([name, value]) => {
      if (node[name] !== value) {
        node[name] = value;
      }
    });
  }),
  "d-attr": generateDirectiveFunc("d-attr", null, (node, result, _component, _originalProp) => {
    Object.entries(result).forEach(([name, value]) => {
      if (node.getAttribute(name) !== value) {
        node.setAttribute(name, value);
      }
    });
  }),
  "d-on-state-change": (component, node) => {
    let str = getAttribute(node, "d-on-state-change");
    let func = compileWithComponent(str, component, "node", "prevState");
    component.addStateHook("d-on-state-change", {
      identifier: "d-on-state-change",
      value: str,
      node,
      hook: (prevState) => func(node, prevState)
    });
    !debug.keepDirectives && removeAttribute(node, "d-on-state-change");
  },
  "d-on-render": (component, node) => {
    let str = getAttribute(node, "d-on-render");
    let func = compileWithComponent(str, component, "node", "transition");
    component.addRenderHook("d-on-render", {
      identifier: "d-on-render",
      value: str,
      node,
      hook: (transition) => func(node, transition)
    });
    !debug.keepDirectives && removeAttribute(node, "d-on-render");
  }
};

// src/component.js
var Component = class {
  constructor(element) {
    this.element = element;
    this.renderHooks = /* @__PURE__ */ new Map();
    this.stateHooks = /* @__PURE__ */ new Map();
    this.eventMap = /* @__PURE__ */ new Map();
    this._componentSpecificDirectives = {};
    this._cleanupTimeout = null;
    this.name = getAttribute(this.element, "d-name") || this.constructor.name;
    !debug.keepDirectives && removeAttribute(this.element, "d-name");
    this.hasHooksInDescendants = getAttribute(this.element, "d-nested-directives") || false;
    let state = {}, str = getAttribute(element, "d-state");
    if (str) {
      str = `
        let {${Object.getOwnPropertyNames(this.context)}} = this.context
        return ${str}
      `;
      state = compileToFunc("context = {}", str).bind(this)(this.context);
    }
    this.state = deepMerge({}, state);
    this.extendInstance();
    this.registerHooks();
    this.hasHooksInDescendants && this.registerHooksInDescendants();
    this.initialState = deepMerge({}, this.state);
  }
  get kebabName() {
    return this.name.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();
  }
  convertDescendantIdentifier(identifier) {
    return identifier.replace(`d-${this.kebabName}-`, "d-");
  }
  registerHooksInDescendants() {
    function getAttributesWithPrefix(element, prefix) {
      const attributes = Array.from(element.attributes);
      const matchingAttributes = attributes.filter((attr) => attr.name.startsWith(prefix));
      const result = {};
      matchingAttributes.forEach((attr) => {
        result[attr.name] = attr.value;
      });
      return result;
    }
    this.element.querySelectorAll("*").forEach((node) => {
      const attributes = getAttributesWithPrefix(node, `d-${this.kebabName}`);
      if (Object.keys(attributes).length == 0)
        return;
      Object.entries(attributes).forEach(([key, value]) => {
        const identifier = this.convertDescendantIdentifier(key);
        const directiveFunc = this.allDirectives()[identifier];
        directiveFunc && directiveFunc(this, node, value);
      });
      let linked = getAttribute(node, "linked-components");
      linked = linked ? JSON.parse(linked) : [];
      setAttribute(node, "linked-components", JSON.stringify([...linked, this.kebabName]));
    });
  }
  extendInstance() {
    extendComponentInstance(this, ...this.mixins());
  }
  mixins() {
    return [];
  }
  addEventListener(identifier, event, node, handler) {
    let nodeEventMap = this.eventMap.get(node);
    if (!nodeEventMap) {
      nodeEventMap = /* @__PURE__ */ new Map();
      this.eventMap.set(node, nodeEventMap);
    }
    this.removeEventListener(identifier, node);
    nodeEventMap.set(identifier, { event, handler });
    node.addEventListener(event, handler);
  }
  removeEventListener(identifier, node) {
    const nodeEventMap = this.eventMap.get(node);
    if (nodeEventMap && nodeEventMap.has(identifier)) {
      const { event, handler } = nodeEventMap.get(identifier);
      node.removeEventListener(event, handler);
      nodeEventMap.delete(identifier);
    }
  }
  unmounted() {
  }
  afterInitialized() {
  }
  runAfterInitializedHook() {
    let hook = "d-after-initialized";
    const func = (node) => {
      let str = getAttribute(node, hook).trim();
      let resultFunc = compileWithComponent(str, this, "node");
      resultFunc(node);
    };
    this.findTopLevel(`[${hook}]`).forEach(func);
  }
  get context() {
    return this.element._dComponentContext || {};
  }
  set context(context) {
    return this.element._dComponentContext = context;
  }
  set parent(parent) {
    this._parent = parent;
  }
  get parent() {
    return this._parent || parents(this.element, "[d-component], [d-state]")[0] && parents(this.element, "[d-component], [d-state]")[0]._dComponent;
  }
  set children(children) {
    this._children = children;
  }
  get children() {
    if (this._children) {
      return [...this._children];
    } else {
      return this.findChildrenElements({ includeElementInLoop: true }).filter((e) => e._dComponent).map((e) => e._dComponent);
    }
  }
  filterChildren(name) {
    return this.children.filter((c) => c.constructor.name == name || c.alias == name);
  }
  portalElements() {
    return document.querySelectorAll(`[d-portal="${this.name}"]`);
  }
  renewFromMutation(node) {
    const hooksChanged = this.registerHooks(node);
    this.debouncedCleanupRemovedNodes();
    hooksChanged && this.render();
  }
  findChildrenElements({ includeElementInLoop = false } = {}) {
    let arr = [];
    [this.element, ...this.portalElements()].forEach((element) => {
      arr = [...arr, ...this._findChildrenElements({ element, includeElementInLoop })];
    });
    return arr;
  }
  _findChildrenElements({ element, includeElementInLoop = false } = {}) {
    let descendant = null;
    if (includeElementInLoop) {
      descendant = findInside(element, "[d-portal] [d-state], [d-portal] [d-component], [d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]");
    } else {
      descendant = findInside(element, "[d-portal] [d-state], [d-portal] [d-component], [d-loop] [d-state], [d-loop] [d-component], [d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]");
    }
    return findInside(element, "[d-state], [d-component]").filter((ele) => !descendant.includes(ele));
  }
  findTopLevel(selector, scopeElement) {
    let arr = [];
    const elements = scopeElement ? [scopeElement] : [this.element, ...this.portalElements()];
    elements.forEach((element) => {
      arr = [...arr, ...this._findTopLevel(element, selector)];
    });
    return arr;
  }
  _findTopLevel(element, selector) {
    let descendant = findInside(element, `[d-portal] ${selector}, [d-loop] ${selector}, [d-state] ${selector}, [d-state]${selector}, [d-component] ${selector}, [d-component]${selector}`);
    let elements = findInside(element, selector).filter((ele) => !descendant.includes(ele));
    isTag(element, selector) && elements.unshift(element);
    return elements;
  }
  get refs() {
    return this.findRefs();
  }
  findRefs() {
    const refs = [];
    this.findTopLevel("[d-ref]").forEach((ele) => {
      let name = getAttribute(ele, "d-ref");
      if (name.slice(-2) == "[]") {
        name = name.slice(0, -2);
        !refs[name] && (refs[name] = []);
        refs[name].push(ele);
      } else {
        refs[name] = ele;
      }
    });
    this.element.querySelectorAll(`[d-${this.kebabName}-ref]`).forEach((ele) => {
      let name = getAttribute(ele, `d-${this.kebabName}-ref`);
      if (name.slice(-2) == "[]") {
        name = name.slice(0, -2);
        !refs[name] && (refs[name] = []);
        refs[name].push(ele);
      } else {
        refs[name] = ele;
      }
    });
    return refs;
  }
  componentSpecificDirectives() {
    return {};
  }
  allDirectives() {
    return Object.assign({}, Directives, this._componentSpecificDirectives, this.componentSpecificDirectives());
  }
  registerHooks(scopeNode = void 0) {
    let updated = false;
    Object.entries(this.allDirectives()).forEach(([hook, func]) => {
      this.findTopLevel(`[${hook}]`, scopeNode).forEach((ele) => {
        updated = true;
        func(this, ele);
      });
    });
    return updated;
  }
  transistionOnStateChanging(prevState, state) {
    prevState == state;
    return {};
  }
  _mergeState(state, newState) {
    return deepMerge(state, newState);
  }
  shouldFollowRender(parent, transition) {
    return true;
  }
  setState(state = {}, transition = {}, triggerRendering = true) {
    let prevState = this.state;
    let cloned = deepMerge({}, this.state);
    let newState = typeof state == "function" ? state(cloned) : this._mergeState(cloned, state);
    this.state = newState;
    if (this._insideStateChanging)
      return;
    this.insideStateChanging(() => this.stateHooks.forEach((nodeHooks, _node) => {
      nodeHooks.forEach((hook) => hook.hook(prevState));
    }));
    cloned = deepMerge({}, this.state);
    debug.keepDirectives && setAttribute(this.element, "d-state", JSON.stringify(cloned));
    transition = deepMerge(this.transistionOnStateChanging(prevState, cloned), transition);
    triggerRendering && this.render(transition);
    return cloned;
  }
  insideStateChanging(func) {
    try {
      this._insideStateChanging = true;
      func();
    } finally {
      this._insideStateChanging = false;
    }
  }
  render(transition = {}) {
    this.renderHooks.forEach((nodeHooks, _node) => {
      nodeHooks.forEach((hook) => hook.hook(transition));
    });
    this.children.forEach((child) => child.shouldFollowRender(this, transition) && child.render(transition));
  }
  debouncedRender() {
    this._renderTimeout && clearTimeout(this._renderTimeout);
    this._renderTimeout = setTimeout(() => {
      this.render();
      this._renderTimeout = null;
    }, 100);
  }
  get root() {
    let par = this.parent;
    while (true) {
      if (par.parent) {
        par = par.parent;
      } else {
        break;
      }
    }
    return par;
  }
  updateHook(identifier, node, inDescendant = false) {
    const originalIdentifier = identifier;
    if (inDescendant) {
      identifier = this.convertDescendantIdentifier(identifier);
    }
    let nodeStateHooks = this.stateHooks.get(node);
    let nodeRenderHooks = this.renderHooks.get(node);
    if (nodeStateHooks) {
      nodeStateHooks.delete(identifier);
    }
    if (nodeRenderHooks) {
      nodeRenderHooks.delete(identifier);
    }
    this.removeEventListener(identifier, node);
    if (node.hasAttribute(originalIdentifier)) {
      let directiveFunc = this.allDirectives()[identifier];
      if (directiveFunc) {
        if (inDescendant) {
          directiveFunc(this, node, getAttribute(node, originalIdentifier));
        } else {
          directiveFunc(this, node);
        }
      }
    }
    this.deboundedHookUpdated(this.render.bind(this));
  }
  hookUpdated() {
  }
  addRenderHook(identifier, hook) {
    let nodeHooks = this.renderHooks.get(hook.node);
    if (!nodeHooks) {
      nodeHooks = /* @__PURE__ */ new Map();
      this.renderHooks.set(hook.node, nodeHooks);
    }
    nodeHooks.set(identifier, hook);
  }
  addStateHook(identifier, hook) {
    let nodeHooks = this.stateHooks.get(hook.node);
    if (!nodeHooks) {
      nodeHooks = /* @__PURE__ */ new Map();
      this.stateHooks.set(hook.node, nodeHooks);
    }
    nodeHooks.set(identifier, hook);
  }
  cleanupRemovedNodes() {
    [this.renderHooks, this.stateHooks, this.eventMap].forEach((map) => {
      for (let [node, _hooks] of map) {
        if (!this.element.contains(node)) {
          map.delete(node);
        }
      }
    });
  }
  debouncedCleanupRemovedNodes() {
    if (this._cleanupTimeout) {
      clearTimeout(this._cleanupTimeout);
    }
    this._cleanupTimeout = setTimeout(() => {
      this.cleanupRemovedNodes();
      this._cleanupTimeout = null;
    }, 100);
  }
  deboundedHookUpdated(func) {
    if (this._hookUpdatedTimeout) {
      clearTimeout(this._hookUpdatedTimeout);
    }
    this._hookUpdatedTimeout = setTimeout(() => {
      this.hookUpdated();
      func && func();
      this._hookUpdatedTimeout = null;
    }, 50);
  }
};
var proxyToParent = (Class) => {
  return new Proxy(Class, {
    get(obj, prop) {
      if (Reflect.has(obj, prop)) {
        return Reflect.get(obj, prop);
      } else {
        return Reflect.get(obj.parent, prop);
      }
    }
  });
};
var ShadowComponent = class extends Component {
  constructor(element) {
    super(element);
    return proxyToParent(this);
  }
  get state() {
    return this.parent ? this.parent.state : this.context.parentComponent.state;
  }
  set state(state) {
    return {};
  }
  setState(...args) {
    return this.parent.setState(...args);
  }
};
var Classes = { Component, ShadowComponent };
var registerComponents = (...components) => {
  components.forEach((component) => Classes[component.name] = component);
  d_render_default.observer && d_render_default.run();
};
var defineComponent = (name, ...objs) => {
  const nameIt = (name2) => ({ [name2]: class extends Component {
    mixins() {
      return objs;
    }
  } })[name2];
  registerComponents(nameIt(name));
};
var extendComponentInstance = (component, ...objs) => {
  let computedObjs = objs.map((obj) => typeof obj === "function" ? obj(component) : obj);
  let _state = {}, _componentSpecificDirectives = {};
  computedObjs.forEach((obj) => {
    let { state = {}, renderHooks = /* @__PURE__ */ new Map(), stateHooks = /* @__PURE__ */ new Map(), componentSpecificDirectives = {} } = obj;
    deepMerge(_state, state);
    renderHooks.forEach((value, key) => {
      if (!component.renderHooks.has(key)) {
        component.renderHooks.set(key, /* @__PURE__ */ new Map());
      }
      value.forEach((hookValue, hookKey) => {
        component.renderHooks.get(key).set(hookKey, hookValue);
      });
    });
    stateHooks.forEach((value, key) => {
      if (!component.stateHooks.has(key)) {
        component.stateHooks.set(key, /* @__PURE__ */ new Map());
      }
      value.forEach((hookValue, hookKey) => {
        component.stateHooks.get(key).set(hookKey, hookValue);
      });
    });
    _componentSpecificDirectives = { ..._componentSpecificDirectives, ...componentSpecificDirectives };
    extendObject(component, obj, ["renderHooks", "stateHooks", "componentSpecificDirectives"]);
  });
  component.state = deepMerge(component.state, _state);
  component._componentSpecificDirectives = { ...component._componentSpecificDirectives, ..._componentSpecificDirectives };
};
var createComponent = (node, { context = {}, ignoreIfClassNotFound = false } = {}) => {
  if (node._dComponent != void 0)
    return node._dComponent;
  node._dComponentContext = context;
  let className = getAttribute(node, "d-component");
  if (ignoreIfClassNotFound && !isNil(className) && !Classes[className]) {
    return null;
  }
  let _class = Classes[className] || Component, component = new _class(node);
  node._dComponent = component;
  let children = component.findChildrenElements();
  children.map((child) => createComponent(child, { context }));
  component.runAfterInitializedHook();
  component.afterInitialized();
  component.hookUpdated();
  if (!debug.keepDirectives) {
    getAttribute(node, "d-state") && setAttribute(node, "d-state", "");
    getAttribute(node, "d-component") && setAttribute(node, "d-component", "");
  }
  return component;
};

// src/d_render.js
var run = () => {
  if (!DRender.observer) {
    let getParentComponent = function(element, kebabName = null) {
      let currentElement = element.parentElement;
      while (currentElement && currentElement !== document.body) {
        if (currentElement._dComponent) {
          if (kebabName) {
            if (currentElement._dComponent.kebabName == kebabName) {
              return currentElement._dComponent;
            }
          } else {
            return currentElement._dComponent;
          }
        }
        currentElement = currentElement.parentElement;
      }
      return null;
    };
    DRender.observer = new MutationObserver((mutationsList, _observer) => {
      for (const mutation of mutationsList) {
        if (mutation.type === "childList") {
          mutation.addedNodes.forEach((node) => {
            if (node.nodeType === node.ELEMENT_NODE) {
              if (node.hasAttribute("d-component") || node.hasAttribute("d-state")) {
                createComponent(node).render();
                emitEvent(node, "d-component-initialized-from-mutation");
              } else {
                const parent = getParentComponent(node);
                if (parent)
                  parent.renewFromMutation(node);
                if (node.querySelectorAll("[d-component], [d-state]").length > 0) {
                  let descendant2 = findInside(node, "[d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]");
                  let top2 = findInside(node, "[d-state], [d-component]").filter((ele) => !descendant2.includes(ele));
                  top2.forEach((node2) => createComponent(node2).render());
                  top2.forEach((node2) => emitEvent(node2, "d-component-initialized-from-mutation"));
                }
              }
            }
          });
          mutation.removedNodes.forEach((node) => {
            if (node.nodeType === node.ELEMENT_NODE) {
              if (node.hasAttribute("d-component") || node.hasAttribute("d-state")) {
                node._DComponent && node._DComponent.unmounted();
              }
              let elements = node.querySelectorAll("[d-component], [d-state]");
              if (elements.length > 0) {
                elements.forEach((ele) => ele._DComponent && ele._DComponent.unmounted());
              }
              let parent = null;
              if (mutation.target.hasAttribute("d-component") || mutation.target.hasAttribute("d-state")) {
                parent = mutation.target._dComponent;
              } else {
                parent = getParentComponent(mutation.target);
              }
              parent && parent.debouncedCleanupRemovedNodes();
            }
          });
        } else if (mutation.type === "attributes") {
          const node = mutation.target;
          const attributeName = mutation.attributeName;
          if (attributeName == "d-state") {
            const stateAttr = node.getAttribute("d-state");
            debug.logAttributeChanges && console.log("d-state changed", stateAttr, node);
            const component = node._dComponent;
            if (component) {
              try {
                const state = JSON.parse(stateAttr);
                if (JSON.stringify(component.state) !== JSON.stringify(state)) {
                  component.setState(state);
                }
              } catch (e) {
                console.error("Invalid JSON in d-state attribute:", stateAttr);
              }
            }
          } else if (attributeName.startsWith("d-")) {
            debug.logAttributeChanges && console.log("attribute changed", attributeName, mutation.oldValue, node);
            if (node._dComponent) {
              node._dComponent.updateHook(attributeName, node);
            } else {
              const parentComponent = getParentComponent(node);
              if (parentComponent) {
                parentComponent.updateHook(attributeName, node);
              }
            }
            let linked = getAttribute(node, "linked-components");
            linked = linked ? JSON.parse(linked) : [];
            linked.forEach((kebabName) => {
              const component = getParentComponent(node, kebabName);
              component && component.updateHook(attributeName, node, true);
            });
          }
        }
      }
    });
    DRender.observer.observe(document, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeOldValue: true
    });
    const addCSS = (css) => document.head.appendChild(document.createElement("style")).innerHTML = css;
    addCSS(".d-render-hidden { display: none !important}");
  }
  let descendant = querySelectorAll("[d-state] [d-component], [d-state] [d-state], [d-component] [d-state], [d-component] [d-state]");
  let top = querySelectorAll("[d-state], [d-component]").filter((ele) => !descendant.includes(ele));
  top.forEach((node) => {
    let component = createComponent(node, { ignoreIfClassNotFound: true });
    component && component.render();
  });
};
var DRender = {
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
  compileWithComponent
};
var d_render_default = DRender;
export {
  Component,
  d_render_default as default,
  defineComponent,
  extendComponentInstance,
  registerComponents
};
//# sourceMappingURL=d_render.js.map
