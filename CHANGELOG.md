# Changelog

## [Unreleased]

### Added
- **Grid snippets** — new snippet type (`type: 'grid'`) for structured table data alongside regular text snippets
- **Grid editor** — inline table editor with editable header row and data rows; "Add Row" button appends a new blank row
- **Add Grid button** in snippets toolbar (icon-only, grid icon) to create a loose grid snippet
- **Add grid inside folders** — "+ Add grid" button appears below "+ Add snippet" inside each folder
- **Grid preview** — read-only mini table rendered in the snippet list (first 3 rows shown)
- **Copy as TSV** — copy button on grid snippets exports tab-separated values for pasting into spreadsheets
- **Drag-and-drop for grids** — grid snippets can be dragged from loose snippets into folders (and back)
- **Edit form stays open on Save** for grid snippets (matches existing snippet UX: only Cancel/Escape closes the form)

### Changed
- Snippets toolbar buttons (Add Snippet, Save Tabs, Load Tabs) replaced with icon-only square buttons (`btn-icon-sq`) with SVG icons and tooltips
- Tab-save/load logic now skips grid snippets when searching for tab URLs
- Escape key closes the Add Grid banner in addition to any active inline form

### Fixed
- Load Tabs banner now correctly dismisses Add Grid banner when opened (and vice versa)
