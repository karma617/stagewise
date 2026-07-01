# ProseMirror Dependency Dedupe

The Electron chat input uses TipTap, which depends on ProseMirror packages.
These packages must resolve to a single runtime copy. If `prosemirror-model`
is installed in multiple versions, TipTap can fail while parsing typed DOM
changes and the input text will disappear immediately.

Keep the ProseMirror core versions pinned in `pnpm-workspace.yaml` under
`overrides`, then run `pnpm install` after changing dependency ranges.

Verification:

```bash
pnpm why prosemirror-model --recursive
```

The output should report one `prosemirror-model` version.
