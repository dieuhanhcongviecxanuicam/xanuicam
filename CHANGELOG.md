# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]
- Initial import of existing website source into repository.
 - Frontend: normalize department display to prefer department names and string-safe lookups; added central `useDepartments` hook. Replace raw numeric `department_id` displays across meeting and task UIs to avoid exposing IDs when `department_name` is missing.
 - Frontend: add `MapPickerModal` (dynamic-loads `react-leaflet` in browser with manual-coordinate fallback) and integrate a "Định vị" action for tasks to save `location_lat`/`location_lng`.
 - Tests: add unit tests for `useDepartments` and update existing tests to be robust; fix Jest ESM issue by dynamic-importing `react-leaflet` so tests run without transpiling node_modules.
 - Build: fix ESLint warnings and adjust map component to avoid unused variables.

## [2026-01-27] - normalize-departments-and-map-picker
- Implemented frontend hardening to prefer department names and string-safe comparisons across multiple components.
- Added interactive map picker with graceful fallback and saving of coordinates to tasks.
- Updated and added tests; all frontend tests pass locally.

