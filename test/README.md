# Testing

This project uses [Bun's built-in test runner](https://bun.sh/docs/cli/test) for fast, native testing.

## Running Tests

```bash
# Run all tests
bun test

# Run tests in watch mode (auto-rerun on file changes)
bun test --watch

# Run tests with coverage report
bun test --coverage

# Run specific test file
bun test src/config.test.ts
```

## Test Structure

Tests are co-located with source files using the `.test.ts` naming convention:

```
src/
├── config.ts
├── config.test.ts          # Tests for config.ts
├── folder-resolver.ts
├── folder-resolver.test.ts # Tests for folder-resolver.ts
└── ...
```

## Writing Tests

Bun's test API is similar to Jest/Vitest:

```typescript
import { describe, test, expect, beforeEach, afterEach } from "bun:test";

describe("MyModule", () => {
  beforeEach(() => {
    // Setup before each test
  });

  test("should do something", () => {
    expect(true).toBe(true);
  });
});
```

## Test Coverage

Current test coverage includes:

- ✅ **Config** (`src/config.test.ts`) - Environment variable loading, ARL management
- ✅ **Folder Resolver** (`src/folder-resolver.test.ts`) - Folder operations, release matching
- ✅ **Library Scanner** (`src/library/scanner.test.ts`) - Artist name normalization, folder scanning
- ✅ **Sync State** (`src/sync/state.test.ts`) - State management, artist tracking

## Adding New Tests

1. Create a `.test.ts` file next to the module you're testing
2. Import the functions you want to test
3. Write test cases using `describe` and `test`
4. Use `expect` assertions to verify behavior

Example:

```typescript
import { describe, test, expect } from "bun:test";
import { myFunction } from "./my-module.js";

describe("myFunction", () => {
  test("should return expected value", () => {
    expect(myFunction("input")).toBe("expected");
  });
});
```

## Best Practices

- **Isolation**: Each test should be independent and not rely on other tests
- **Cleanup**: Use `beforeEach`/`afterEach` to set up and tear down test state
- **Descriptive names**: Test names should clearly describe what they're testing
- **Edge cases**: Test both happy paths and error cases
- **Mock external dependencies**: Use mocks for file system, network calls, etc.

## Continuous Integration

Tests should pass before merging PRs. Consider adding a GitHub Actions workflow to run tests automatically.

