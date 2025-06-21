# Change Log

## Version 0.3.5 (2024-06-30)

**New Features:**
- Added support for handling recursive types with configurable recursion depth
- New configuration options:
  - `recursionDepth`: Set global recursion depth limit (default: 5)
  - `typeRecursionMap`: Set type-specific recursion depth limits

## Version 0.2.2 (2024-05-16)

**New Features:**

* Remove `optionalType` option from the extension configuration file.
* Add `fetchPolicy` option to the extension configuration file. You can set apollo fetchPolicy value as field of this value.

**Fix Error:**

* Fix optional field extraction.
* Fix type and api function arguments of array.
* Fix detect query of subscription.

## [Unreleased]

### Added
- Added support for handling recursive types with configurable recursion depth
- New configuration options:
  - `recursionDepth`: Set global recursion depth limit (default: 5)
  - `typeRecursionMap`: Set type-specific recursion depth limits
