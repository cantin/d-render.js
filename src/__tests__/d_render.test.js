import DRender from '../d_render';
import { createComponent } from '../component';

jest.mock('../component', () => ({
  createComponent: jest.fn(),
}));

describe('DRender MutationObserver', () => {
  let observer;
  let mockUpdateHook;

  beforeEach(() => {
    // Mock the global MutationObserver
    global.MutationObserver = jest.fn(function(callback) {
      this.observe = jest.fn();
      this.disconnect = jest.fn();
      observer = { callback };
    });

    // Mock component methods
    mockUpdateHook = jest.fn();
    createComponent.mockImplementation(() => ({
      updateHook: mockUpdateHook,
    }));

    // Run DRender to set up the observer
    DRender.run();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should call updateHook when a d-attribute is changed', () => {
    // Create a mock element
    const mockElement = document.createElement('div');
    mockElement._dComponent = { updateHook: mockUpdateHook };

    // Simulate a mutation
    const mockMutation = {
      type: 'attributes',
      target: mockElement,
      attributeName: 'd-text',
    };

    // Trigger the observer callback
    observer.callback([mockMutation]);

    // Check if updateHook was called with correct arguments
    expect(mockUpdateHook).toHaveBeenCalledWith('d-text', mockElement);
  });

  test('should not call updateHook when a non-d-attribute is changed', () => {
    const mockElement = document.createElement('div');
    mockElement._dComponent = { updateHook: mockUpdateHook };

    const mockMutation = {
      type: 'attributes',
      target: mockElement,
      attributeName: 'class',
    };

    observer.callback([mockMutation]);

    expect(mockUpdateHook).not.toHaveBeenCalled();
  });
});
