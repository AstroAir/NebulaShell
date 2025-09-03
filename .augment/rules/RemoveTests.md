---
type: "manual"
---

Review and organize the test files in this codebase by:

1. **Identify duplicate tests**: Find test cases that verify the same functionality or behavior across different test files
2. **Remove redundant tests**: Delete tests that are exact duplicates or provide no additional coverage beyond existing tests
3. **Consolidate related tests**: Group similar test cases together in appropriate test files based on the functionality they're testing
4. **Maintain test coverage**: Ensure that removing duplicate tests doesn't reduce the overall test coverage or miss important edge cases
5. **Update test organization**: Reorganize test files and test suites to follow a logical structure that makes them easier to maintain

Before making any changes:
- Analyze the current test structure and identify which tests are duplicated
- Verify that tests marked for deletion are truly redundant and not testing different edge cases
- Ensure the remaining tests provide comprehensive coverage of the codebase functionality

Please provide a summary of what duplicate/redundant tests were found and what changes were made to improve the test organization.