// Mock implementations for XTerm.js and its addons

class MockTerminal {
  constructor() {
    this.element = document.createElement('div');
    this.cols = 80;
    this.rows = 24;
    this.onData = jest.fn();
    this.onResize = jest.fn();
    this.onKey = jest.fn();
    this.onBinary = jest.fn();
    this.onCursorMove = jest.fn();
    this.onLineFeed = jest.fn();
    this.onScroll = jest.fn();
    this.onSelectionChange = jest.fn();
    this.onRender = jest.fn();
    this.onTitleChange = jest.fn();
    this.onBell = jest.fn();

    // Make all methods jest spies
    this.write = jest.fn();
    this.writeln = jest.fn();
    this.clear = jest.fn();
    this.reset = jest.fn();
    this.focus = jest.fn();
    this.blur = jest.fn();
    this.dispose = jest.fn();
    this.loadAddon = jest.fn((addon) => {
      if (addon && typeof addon.activate === 'function') {
        addon.activate(this);
      }
      return this;
    });
    this.attachCustomKeyEventHandler = jest.fn();
    this.resize = jest.fn();
    this.fit = jest.fn();
    this.scrollToBottom = jest.fn();
    this.scrollToTop = jest.fn();
    this.selectAll = jest.fn();
    this.getSelection = jest.fn(() => '');
    this.hasSelection = jest.fn(() => false);
    this.clearSelection = jest.fn();
  }

  open(parent) {
    if (parent) {
      parent.appendChild(this.element);
    }
  }
}

class MockFitAddon {
  constructor() {
    this.proposeDimensions = jest.fn().mockReturnValue({ cols: 80, rows: 24 });
    this.fit = jest.fn();
  }

  activate(terminal) {
    this.terminal = terminal;
  }

  dispose() {
    // Mock dispose
  }
}

class MockWebLinksAddon {
  constructor() {
    // Mock constructor
  }

  activate(terminal) {
    this.terminal = terminal;
  }

  dispose() {
    // Mock dispose
  }
}

class MockSearchAddon {
  constructor() {
    this.findNext = jest.fn();
    this.findPrevious = jest.fn();
  }

  activate(terminal) {
    this.terminal = terminal;
  }

  dispose() {
    // Mock dispose
  }
}

class MockUnicode11Addon {
  constructor() {
    // Mock constructor
  }

  activate(terminal) {
    this.terminal = terminal;
  }

  dispose() {
    // Mock dispose
  }
}

module.exports = {
  MockTerminal,
  MockFitAddon,
  MockWebLinksAddon,
  MockSearchAddon,
  MockUnicode11Addon,
};
