# D-Render Guide

## Overview

D-Render is a lightweight reactive UI library like Alpine.js, inspired by Vue and React. It provides a powerful component-based architecture with reactive state management and a comprehensive directive system.

The D-Render is built on three fundamental concepts:

1. **Components** - Self-contained, reusable UI elements that:
   - Manage their own state and render lifecycle
   - Can be nested to create complex UIs
   - Are initialized with either `d-component` or `d-state` attributes
   - Can define custom directives and hooks
   - Can be extended through JavaScript classes
   - Support mixins for code reuse
   - Can proxy to parent components for shared state

2. **State Management** - Reactive data model that:
   - Is defined using the `d-state` attribute or in component classes
   - Automatically triggers UI updates when modified
   - Can be accessed and modified through various directives
   - Supports transitions for animated state changes
   - Provides deep merging for complex state updates
   - Includes callback support for async operations

3. **Directives** - HTML attributes that:
   - Begin with the `d-` prefix (e.g., `d-click`, `d-show`)
   - Connect the DOM with component state
   - Handle events, conditional rendering, and data binding
   - Can be component-specific or made globally available
   - Can be extended with custom functionality
   - Support modifiers for enhanced behavior

## Core Concepts

### Components

Components are initialized in two ways:

```html
<!-- Using d-state -->
<div d-state="{ count: 0, displayed: true }">
  <!-- Component content -->
</div>

<!-- Using d-component -->
<div d-component="MyComponent">
  <!-- Component content -->
</div>
```

When D-Render initializes components, it attaches the component instance to DOM elements via a `_dComponent` property.
You can get the component instance using `element._dComponent`.

```javascript
// Access the component instance from a DOM element
const element = document.querySelector('[d-component="MyComponent"]');
const component = element._dComponent;

// Use component methods and properties
component.setState({ count: 5 });
console.log(component.state);
```

### Component Classes

Define custom components with extended functionality:

```javascript
class MyComponent extends DRender.Component {
  // Default state that merges with provided state
  defaultState(state) {
    return {
      count: 0,
      isVisible: true,
      ...state
    }
  }

  // Component-specific directives
  componentSpecificDirectives() {
    return {
      'd-custom': (component, node) => {
        // Custom directive implementation
      }
    }
  }

  // Mixins for code reuse
  mixins() {
    return [MyMixin, AnotherMixin];
  }

  // Lifecycle hooks
  afterInitialized() {
    // Setup after component initialization
    console.log('Component initialized');
  }

  stateChanged(prevState) {
    // Handle state changes
    console.log('State changed from', prevState, 'to', this.state);
  }

  childrenChanged(child) {
    // Handle child component changes
    console.log('Child component changed:', child);
  }

  unmounted() {
    // Cleanup when component is destroyed
    console.log('Component unmounted');
  }

  // State transitions for animations
  transistionOnStateChanging(prevState, newState) {
    // Return transition object for render() method
    return { animate: true };
  }

  // Control child component rendering
  shouldFollowRender(parent, transition) {
    // Return false to prevent child re-rendering
    return true;
  }

  // Custom methods
  increment() {
    this.setState({ count: this.state.count + 1 });
  }
}
```

### Mixins System

Reuse code across components using mixins:

```javascript
const CounterMixin = (component) => ({
  state: {
    count: 0
  },

  increment() {
    this.setState({ count: this.state.count + 1 });
  },

  decrement() {
    this.setState({ count: this.state.count - 1 });
  }
});

const LoggingMixin = (component) => ({
  stateChanged(prevState) {
    console.log('State changed:', prevState, '->', this.state);
  }
});

class MyComponent extends DRender.Component {
  mixins() {
    return [CounterMixin, LoggingMixin];
  }
}
```

### State Management

- Declare state using d-state attribute
- Update state using Component#setState()
- Each setState triggers a render to update UI
- Changes trigger automatic DOM updates
- Supports deep merging and functional updates

```javascript
// Simple state update
this.setState({ count: 5 });

// Functional state update
this.setState(prevState => ({ count: prevState.count + 1 }));

// With callback
this.setState({ count: 5 }, () => {
  console.log('State updated');
});

// With transition and callback
this.setState({ count: 5 }, { animate: true }, () => {
  console.log('State updated with transition');
});
```

### Basic Directives

#### 1. Event Handlers

```html
<!-- Simple state update -->
<button d-click="{ count: count + 1 }">Click</button>

<!-- Method calls -->
<input d-change="handleChange">
<form d-submit="handleSubmit">

<!-- Multiple statements -->
<button d-click="increment(); logAction()">Increment</button>
```

Available events:
- d-click
- d-change
- d-input
- d-keyup
- d-keypress
- d-submit
- d-focus
- d-blur

#### 2. Event Modifiers

```html
<!-- Prevent default and stop propagation -->
<button d-click.prevent.stop="handleClick">Click</button>

<!-- Debounced input (400ms default) -->
<input d-input.debounce="handleInput">

<!-- Custom debounce duration -->
<input d-input.debounce="handleInput" d-debounce-duration="1000">
```

#### 3. Conditional Display

```html
<!-- Simple show/hide -->
<div d-show="isVisible">Shows/hides based on state</div>

<!-- Debounced show/hide -->
<div d-debounce-show="isVisible" d-debounce-duration="300">
  Debounced visibility
</div>
```

#### 4. Class Binding

```html
<!-- Object syntax -->
<div d-class="{ active: isActive, 'text-danger': hasError }">

<!-- String syntax -->
<div d-class="dynamicClass">

<!-- Debounced class changes -->
<div d-debounce-class="{ active: isActive }" d-debounce-duration="200">
```

#### 5. Style Binding

```html
<div d-style="{ color: textColor, fontSize: size + 'px' }">
```

#### 6. Text/HTML Content

```html
<div d-text="message"></div>
<div d-html="htmlContent"></div>
```

#### 7. Two-way Data Binding

```html
<!-- Text input -->
<input d-model="message">

<!-- Checkbox -->
<input type="checkbox" d-model="isChecked">

<!-- Radio buttons -->
<input type="radio" d-model="selectedOption" value="option1">
<input type="radio" d-model="selectedOption" value="option2">
```

#### 8. Props & Attributes

```html
<!-- Set DOM properties -->
<input d-prop="{ value: inputValue, placeholder: 'Enter text' }">

<!-- Set HTML attributes -->
<img d-attr="{ src: imageUrl, alt: imageAlt }">

<!-- Disabled/Readonly states -->
<button d-disabled="!isValid">Submit</button>
<input d-readonly="isViewOnly">
```

### Loops

```html
<!-- Basic loop -->
<div d-loop="items" d-loop-var="item">
  <template>
    <div d-key="item.id">
      <p d-text="item.name"></p>
      <p d-text="itemIndex"></p>
    </div>
  </template>
</div>

<!-- Object loop -->
<div d-loop="userObject" d-loop-var="user">
  <template>
    <div d-key="userKey">
      <span d-text="userKey"></span>: <span d-text="user"></span>
    </div>
  </template>
</div>
```

### Component Relationships

#### Parent-Child Relationships

```html
<div d-component="ParentComponent">
  <div d-component="ChildComponent">
    <!-- ChildComponent can access ParentComponent via this.parent -->
  </div>
</div>
```

In the child component:
```javascript
class ChildComponent extends DRender.Component {
  afterInitialized() {
    // Access parent component
    const parentState = this.parent.state;

    // Call methods on parent component
    this.parent.someMethod();

    // Update parent state
    this.parent.setState({ parentUpdated: true });

    // Access root component
    this.root.setState({ rootUpdated: true });
  }
}
```

#### Finding Child Components

```javascript
class ParentComponent extends DRender.Component {
  afterInitialized() {
    // Get all child components
    const allChildren = this.children;

    // Filter children by component name
    const specificChildren = this.filterChildren('ChildComponent');

    // Access child state
    const childState = specificChildren[0].state;
  }
}
```

#### Shadow Components

Shadow components proxy to their parent for shared state:

```html
<div d-component="ParentComponent" d-state="{ sharedCount: 0 }">
  <div d-component="ShadowComponent">
    <!-- This component shares state with parent -->
  </div>
</div>
```

### Portal Elements

Portal elements allow you to render component content in different DOM locations:

```html
<!-- Define portal targets -->
<div id="modal-container"></div>
<div id="notification-container"></div>

<!-- Component with portal support -->
<div d-component="ModalComponent" d-global-directives>
  <div class="modal-content">
    <!-- This will appear in original location -->
    <h2>Modal Title</h2>
    <p>Modal Content</p>
  </div>
</div>

<!-- Portal targets will receive component content -->
<div d-portal="ModalComponent"></div>
```

### Global Directives

Components can make their directives available globally:

```html
<!-- Component with global directives -->
<div d-component="ModalManager" d-global-directives d-state="{ isOpen: false }">
  <div class="modal" d-class="{ active: isOpen }">
    <div class="modal-content">
      <h2>Modal</h2>
      <button d-click="{ isOpen: false }">Close</button>
    </div>
  </div>
</div>

<!-- Use component directives globally -->
<button d-modal-manager-click="{ isOpen: true }">
  Open Modal
</button>

<!-- Global refs -->
<button d-modal-manager-ref="openButton">Open</button>
```

### Lifecycle Hooks

#### State Change Hook

```html
<div d-on-state-change="handleStateChange(prevState)">
```

#### Render Hook

```html
<div d-on-render="handleRender(transition)">
```

#### Initialize Hook

```html
<div d-after-initialized="handleInit">
```

### References

Access DOM elements through refs:

```html
<!-- Single ref -->
<input d-ref="usernameInput">

<!-- Array ref -->
<div d-ref="items[]">Item 1</div>
<div d-ref="items[]">Item 2</div>

<!-- Component-specific refs -->
<button d-my-component-ref="submitButton">Submit</button>
```

In component:
```javascript
class MyComponent extends DRender.Component {
  afterInitialized() {
    // Access refs
    const input = this.refs.usernameInput;
    const items = this.refs.items; // Array
    const submitBtn = this.refs.submitButton;

    input.focus();
  }
}
```

## Advanced Features

### MutationObserver Integration

D-Render automatically detects DOM changes and updates components:

```javascript
// Components are automatically created/destroyed when DOM changes
const newElement = document.createElement('div');
newElement.setAttribute('d-component', 'MyComponent');
document.body.appendChild(newElement); // Component automatically initialized
```

### Debug Mode

Enable debug logging for development:

```javascript
// Enable debug features
DRender.debug.logAllFuncStr = true;        // Log function compilation
DRender.debug.logCompiledFuncExecutionError = true;  // Log execution errors
DRender.debug.logAttributeChanges = true;  // Log attribute changes
DRender.debug.keepDirectives = true;       // Keep directives in DOM for inspection
```

### Component Utilities

```javascript
// Find components by name
const components = DRender.findComponents('MyComponent');

// Get component hierarchy
DRender.graphComponents(); // Console log component tree

// Access closest component to element
const component = element.closestComponent();

// Access component depth
const depth = component.depth;

// Get component name formats
const kebabName = component.kebabName;      // my-component
const kebabPrefix = component.kebabPrefix;  // d-my-component
```

### Performance Optimization

```javascript
// Debounced rendering
this.setState({ count: 5 }, {}, false); // Don't trigger render
this.setState({ count: 6 }, {}, true, true); // Immediate render

// Control child rendering
shouldFollowRender(parent, transition) {
  // Prevent unnecessary child re-renders
  return this.state.shouldUpdateChildren;
}
```

## API Reference

### Component API

#### Properties
- `element` - DOM element associated with component
- `state` - Component state object
- `parent` - Parent component instance
- `children` - Array of child components
- `root` - Root component instance
- `refs` - Object containing DOM element references
- `depth` - Component depth in hierarchy
- `name` - Component name
- `kebabName` - Kebab-case component name
- `kebabPrefix` - Directive prefix for global directives

#### Methods
- `setState(state, transition, triggerRendering, immediateRendering)` - Update component state
- `destroy()` - Clean up component and remove event listeners
- `filterChildren(name)` - Get child components by name
- `findRefs()` - Get all DOM element references
- `closestComponent(element)` - Get closest component to element

#### Lifecycle Methods
- `defaultState(state)` - Define default state values
- `afterInitialized()` - Called after component initialization
- `stateChanged(prevState)` - Called when state changes
- `childrenChanged(child)` - Called when child components change
- `unmounted()` - Called when component is destroyed
- `transistionOnStateChanging(prevState, newState)` - Define state transitions
- `shouldFollowRender(parent, transition)` - Control child rendering
- `mixins()` - Return array of mixins to apply
- `componentSpecificDirectives()` - Define custom directives

### DRender Global API

#### Methods
- `run()` - Initialize D-Render and scan DOM for components
- `registerComponents(...components)` - Register component classes
- `defineComponent(name, ...mixins)` - Define component with mixins
- `findComponents(name, scopeNode)` - Find components by name
- `graphComponents(html, scopeNode)` - Log component hierarchy
- `closestComponent(node)` - Get closest component to element
- `addHelpers()` - Add global helper methods to window
- `createComponent(node, options)` - Create component from element

#### Properties
- `Component` - Base component class
- `Directives` - Object containing all directive implementations
- `Prefixes` - Object containing event modifier implementations
- `debug` - Debug configuration object

### Directives Reference

#### Event Directives
- `d-click` - Click event handler
- `d-change` - Change event handler
- `d-input` - Input event handler
- `d-keyup` - Keyup event handler
- `d-keypress` - Keypress event handler
- `d-submit` - Submit event handler
- `d-focus` - Focus event handler
- `d-blur` - Blur event handler

#### Event Modifiers
- `.prevent` - Call event.preventDefault()
- `.stop` - Call event.stopPropagation()
- `.debounce` - Debounce event handler

#### Conditional Directives
- `d-show` - Show/hide element based on condition
- `d-debounce-show` - Debounced show/hide
- `d-disabled` - Enable/disable element
- `d-readonly` - Make element read-only

#### Binding Directives
- `d-model` - Two-way data binding
- `d-text` - Set text content
- `d-html` - Set HTML content
- `d-value` - Set element value
- `d-class` - Bind CSS classes
- `d-style` - Bind inline styles
- `d-prop` - Set DOM properties
- `d-attr` - Set HTML attributes

#### Structural Directives
- `d-loop` - Loop over arrays/objects
- `d-key` - Unique key for loop items

#### Lifecycle Directives
- `d-on-state-change` - State change hook
- `d-on-render` - Render hook
- `d-after-initialized` - Initialize hook

#### Reference Directives
- `d-ref` - DOM element reference
- `d-component-ref` - Component-specific reference

## Examples

### Complete Todo Application

```html
<div d-component="TodoApp" d-state="{
  todos: [
    { id: 1, text: 'Learn D-Render', completed: true },
    { id: 2, text: 'Build an app', completed: false }
  ],
  newTodo: '',
  filter: 'all'
}">
  <h1>Todo List</h1>

  <!-- Add new todo -->
  <div class="input-group">
    <input
      d-model="newTodo"
      d-keypress.enter="addTodo"
      placeholder="What needs to be done?"
      class="todo-input"
      d-ref="newTodoInput">
    <button d-click="addTodo">Add</button>
  </div>

  <!-- Todo filters -->
  <div class="filters">
    <button
      d-click="{ filter: 'all' }"
      d-class="{ active: filter === 'all' }">All</button>
    <button
      d-click="{ filter: 'active' }"
      d-class="{ active: filter === 'active' }">Active</button>
    <button
      d-click="{ filter: 'completed' }"
      d-class="{ active: filter === 'completed' }">Completed</button>
  </div>

  <!-- Todo list -->
  <ul class="todo-list">
    <div d-loop="filteredTodos()" d-loop-var="todo">
      <template>
        <li d-key="todo.id">
          <div d-class="{ completed: todo.completed }">
            <input
              type="checkbox"
              d-prop="{ checked: todo.completed }"
              d-change="toggleTodo(todo.id)">
            <span d-text="todo.text"></span>
            <button
              class="delete-btn"
              d-click="removeTodo(todo.id)">×</button>
          </div>
        </li>
      </template>
    </div>
  </ul>

  <!-- Status and bulk actions -->
  <div class="todo-footer" d-show="todos.length > 0">
    <span d-text="remainingCount() + ' items left'"></span>
    <button
      d-click="clearCompleted"
      d-show="todos.some(t => t.completed)">
      Clear completed
    </button>
  </div>

  <!-- Empty state -->
  <p d-show="todos.length === 0" class="empty-state">
    No todos yet! Add one above.
  </p>
</div>

<script>
class TodoApp extends DRender.Component {
  filteredTodos() {
    if (this.state.filter === 'active') {
      return this.state.todos.filter(todo => !todo.completed);
    } else if (this.state.filter === 'completed') {
      return this.state.todos.filter(todo => todo.completed);
    } else {
      return this.state.todos;
    }
  }

  remainingCount() {
    return this.state.todos.filter(todo => !todo.completed).length;
  }

  addTodo() {
    const text = this.state.newTodo.trim();
    if (text) {
      this.setState({
        todos: [...this.state.todos, {
          id: Date.now(),
          text,
          completed: false
        }],
        newTodo: ''
      }, () => {
        // Focus input after adding
        this.refs.newTodoInput.focus();
      });
    }
  }

  toggleTodo(id) {
    this.setState({
      todos: this.state.todos.map(todo =>
        todo.id === id ? { ...todo, completed: !todo.completed } : todo
      )
    });
  }

  removeTodo(id) {
    this.setState({
      todos: this.state.todos.filter(todo => todo.id !== id)
    });
  }

  clearCompleted() {
    this.setState({
      todos: this.state.todos.filter(todo => !todo.completed)
    });
  }
}

DRender.registerComponents(TodoApp);
DRender.run();
</script>
```

### Modal Component with Global Directives

```html
<!-- Modal manager component -->
<div d-component="ModalManager" d-global-directives d-state="{
  isOpen: false,
  title: '',
  content: ''
}">
  <div class="modal-backdrop" d-class="{ active: isOpen }" d-click="{ isOpen: false }">
    <div class="modal" d-click.stop>
      <div class="modal-header">
        <h3 d-text="title"></h3>
        <button d-click="{ isOpen: false }}">&times;</button>
      </div>
      <div class="modal-body" d-html="content"></div>
      <div class="modal-footer">
        <button d-click="{ isOpen: false }">Close</button>
      </div>
    </div>
  </div>
</div>

<!-- Using modal globally -->
<button d-modal-manager-click="{
  isOpen: true,
  title: 'Hello World',
  content: '<p>This is a modal!</p>'
}">
  Open Modal
</button>

<!-- Modal with component-specific ref -->
<button d-modal-manager-ref="openModalBtn">Open Modal</button>
```

## Best Practices

1. **State Management**
   - Always use `setState()` to update state
   - Keep state simple and focused
   - Use functional updates for complex state changes
   - Leverage deep merging for nested objects

2. **Component Design**
   - Keep components focused and reusable
   - Use mixins for shared functionality
   - Implement proper cleanup in `unmounted()`
   - Use lifecycle hooks for setup/teardown

3. **Performance**
   - Use `shouldFollowRender()` to optimize child rendering
   - Implement debouncing for frequent events
   - Avoid unnecessary state updates
   - Use refs instead of queries when possible

4. **Directives**
   - Create custom directives for reusable behavior
   - Use global directives for cross-component functionality
   - Leverage event modifiers for common patterns
   - Keep directive logic simple and focused

## Debugging

1. **Enable Debug Mode**
```javascript
DRender.debug.logAllFuncStr = true;
DRender.debug.logCompiledFuncExecutionError = true;
DRender.debug.logAttributeChanges = true;
DRender.debug.keepDirectives = true;
```

2. **Component Inspection**
```javascript
// View component tree
DRender.graphComponents();

// Find components
const components = DRender.findComponents('MyComponent');

// Access component from element
const component = element._dComponent;

// Use global helpers
graphComponents();
findComponents();
$0.closestComponent;
```

3. **State Debugging**
```javascript
// Log state changes
class MyComponent extends DRender.Component {
  stateChanged(prevState) {
    console.log('State changed:', prevState, '->', this.state);
  }
}
```

## Tips

1. Always use `setState()` to update state - never modify state directly
2. Use transitions for temporary UI states and animations
3. Keep components small and focused on single responsibilities
4. Use refs to access DOM elements directly when needed
5. Leverage lifecycle hooks for proper setup and cleanup
6. Use mixins to share common functionality across components
7. Implement `shouldFollowRender()` for performance optimization
8. Use global directives for cross-component communication
9. Enable debug mode during development for better visibility
10. Use the component graph to visualize your application structure

