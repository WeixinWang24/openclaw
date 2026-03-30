# code-reader

Phase 2 home for the Vio CodeReader migration.

## Intended scope
- current-file content loading
- current-file display boundary
- editor-state and dirty-state semantics
- save and undo behavior for the current file

## Note
CodeReader owns file-content and editor-state behavior, not workspace tree traversal or explorer navigation.
