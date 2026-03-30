# code-reader

CodeView / CodeReader module for the Vio workspace surface.

## Intended scope
- current-file content loading
- codeview display boundary
- editor-state and dirty-state semantics
- save and undo behavior for the current file

## Note
CodeReader owns file-content and editor-state behavior, not workspace tree traversal or explorer navigation.
