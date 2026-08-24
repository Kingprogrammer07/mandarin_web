import "@testing-library/jest-dom/vitest"

// The app reads window.Telegram in guards, haptics and theme detection. In
// jsdom it is absent, so anything touching it throws before the assertion is
// reached. A minimal inert stub keeps tests exercising real code paths rather
// than mocking around them.
Object.defineProperty(window, "Telegram", {
  writable: true,
  configurable: true,
  value: {
    WebApp: {
      colorScheme: "light",
      initData: "",
      HapticFeedback: {
        notificationOccurred: () => {},
        impactOccurred: () => {},
        selectionChanged: () => {},
      },
      ready: () => {},
      expand: () => {},
    },
  },
})
