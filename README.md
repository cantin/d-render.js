# D-Render Guide

## Overview

D-Render is a lightweight reactive UI lib like Alpine.js, inspired by Vue and React.

The D-Render is built on three fundamental concepts:

1. **Components** - Self-contained, reusable UI elements that:
   - Manage their own state and render lifecycle
   - Can be nested to create complex UIs
   - Are initialized with either `d-component` or `d-state` attributes
   - Can define custom directives and hooks
   - Can be extended through JavaScript classes

2. **State Management** - Reactive data model that:
   - Is defined using the `d-state` attribute or in component classes
   - Automatically triggers UI updates when modified
   - Can be accessed and modified through various directives
   - Supports transitions for animated state changes

3. **Directives** - HTML attributes that:
   - Begin with the `d-` prefix (e.g., `d-click`, `d-show`)
   - Connect the DOM with component state
   - Handle events, conditional rendering, and data binding
   - Can be component-specific or made globally available
   - Can be extended with custom functionality

D-Render combines these concepts to provide a lightweight yet powerful lib for building reactive user interfaces with minimal boilerplate.

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

### State Management

- Declare state using d-state attribute
- Update state using Component#setState()
- Each setState triggers a render to update UI
- Changes trigger automatic DOM updates

### Basic Directives

1. Event Handlers:
```html
<button d-click="{ count: count + 1 }">Click</button>  // equal to setState({ count: count + 1 })
<input d-change="handleChange">
<form d-submit="handleSubmit">
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

Event modifiers:
```html
<!-- Event modifiers -->
<button d-click.prevent.stop="handleClick">Click</button>
<input d-input.debounce="handleInput">
```

2. Conditional Display:
```html
<div d-show="isVisible">Shows/hides based on state</div>
```

3. Class Binding:
```html
<!-- Object syntax -->
<div d-class="{ active: isActive, 'text-danger': hasError }">

<!-- String syntax -->
<div d-class="dynamicClass">
```

4. Style Binding:
```html
<div d-style="{ color: textColor, fontSize: size + 'px' }">
```

5. Text/HTML Content:
```html
<div d-text="message"></div>
<div d-html="htmlContent"></div>
```

6. Two-way Data Binding:
```html
<input d-model="message">
```

7. Props & Attributes:
```html
<input d-prop="{ value: inputValue, placeholder: 'Enter text' }">
<img d-attr="{ src: imageUrl, alt: imageAlt }">
```

### Loops

```html
<div d-loop="items" d-loop-var="item">
  <template>
    <div d-key="itemKey">
      <p d-text="item"></p>
      <p d-text="itemIndex"></p>
    </div>
  </template>
</div>
```

### Custom Components

1. Define Component:
```javascript
class MyComponent extends DRender.Component {
  defaultState(state) {
    return {
      count: 0,
      ...state
    }
  }

  componentSpecificDirectives() {
    return {
      'd-custom': (component, node) => {
        // Custom directive implementation
      }
    }
  }

  stateChanged(prevState) {
    // Handle state changes
  }

  afterInitialized() {
    // Setup after component init
  }

  childrenChanged() {
    // Handle child component changes
  }

  transistionOnStateChanging() {
    // Handle transitions on state change
    // transitions is a flag that passed to render() to do one-off actions
    // like focus, scrollIntoView, etc.
    // You need to override the render() method to use this
  }

  // A function to determine whether child components should re-render or not while parent get re-rendering.
  // meant to be overridden
  shouldFollowRender(parent, transition) {
    return true
  }
}

// Register component
DRender.registerComponents(MyComponent)
```

2. Use Component:
```html
<div d-component="MyComponent">
  <!-- Component content -->
</div>
```

### Lifecycle & Events

1. State Change Hook:
```html
<div d-on-state-change="handleStateChange(prevState)">
```

2. Render Hook:
```html
<div d-on-render="handleRender(transition)">
```

3. Initialize Hook:
```html
<div d-after-initialized="handleInit()">
```

### Component Relationships

D-Render creates a hierarchical structure of components reflecting the DOM structure. Components can access their parent, children, and root components for state sharing and coordination:

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

    // Listen to parent state changes
    this.parent.setState({ parentUpdated: true });

    // Also there is a root component which is the top-level component
    this.root.setState({ rootUpdated: true });
  }
}
```

#### Finding Child Components

Parent components can access their children through the `children` property:

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

### Portal Elements

Portal elements allow you to render component content in a different part of the DOM tree while maintaining the component's context and state management.

```html
<!-- Define a portal target -->
<div d-portal="MyComponent"></div>

<!-- Component content will render both in its original location and in the portal target -->
<div d-component="MyComponent">
  <p>This content will appear in both locations</p>
</div>
```

### Global Directives

Components can make their directives available globally throughout the application using the `d-global-directives` attribute:

```html
<!-- Define a component with global directives -->
<div d-component="MyComponent" d-global-directives>
  <!-- Component content -->
</div>
```

With global directives enabled, component-specific directives can be used on any element in the application using the component's kebab-case name as a prefix:

```html
<!-- Using component directives globally -->
<div d-my-component-custom="value">
  This element uses MyComponent's custom directive
</div>

<!-- Component-specific refs can also be used globally -->
<button d-my-component-ref="submitButton">Submit</button>
```

Usage examples:

1. Creating a reusable modal component with global controls:
```html
<!-- Modal component with global directives -->
<div d-component="ModalManager" d-global-directives d-state="{ isOpen: false, content: '' }">
  <div class="modal" d-class="{ active: isOpen }">
    <div class="modal-content" d-html="content"></div>
    <button d-click="{ isOpen: false }">Close</button>
  </div>
</div>

<!-- Using modal directives anywhere in the application -->
<button d-modal-manager-click="{ isOpen: true, content: '<h2>Hello World</h2>' }">
  Open Modal
</button>
```

2. In JavaScript:
```javascript
class MyComponent extends DRender.Component {
  componentSpecificDirectives() {
    return {
      // These directives will be available globally with d-my-component- prefix
      'd-custom': (component, node) => {
        // Custom directive implementation
      }
    }
  }
}

### Initialize the D-Render
```javascript
// Initialize d-render
DRender.run()
// register components
DRender.registerComponents(MyComponent, MyOtherComponent)

// Find component instances
DRender.findComponents('ComponentName')

// Add global helper methods
DRender.addHelpers()

// After adding helpers, you can use them in dev console for debugging

graphComponents() // View component tree
findComponents() // equal to DRender.findComponents()
$0.closestComponent
```

## Examples

### Todo List Application

Here's a complete Todo list application that showcases many D-Render features:

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
      d-keypress.enter="addTodo()"
      placeholder="What needs to be done?"
      class="todo-input">
    <button d-click="addTodo()">Add</button>
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
      d-click="clearCompleted()"
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

## Tips

1. Always use setState() to update state
2. Use transitions for temporary UI states
3. Keep components focused and reusable
4. Use refs to access DOM elements directly
5. Leverage lifecycle hooks for setup/cleanup

## Debugging

1. Enable debug logging:
```javascript
DRender.debug.logAllFuncStr = true
DRender.debug.logCompiledFuncExecutionError = true
DRender.debug.logAttributeChanges = true
```

2. Visualize component tree:
```javascript
DRender.graphComponents()
```
