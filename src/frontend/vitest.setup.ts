import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

import "@testing-library/jest-dom/vitest";

// @testing-library/react's automatic afterEach cleanup relies on detecting a
// global `afterEach` (as injected by `test.globals: true`). This project
// keeps globals off, so unmount rendered trees explicitly between tests.
afterEach(() => {
  cleanup();
});
