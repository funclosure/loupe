# Creating a Lens

Create a directory under `lenses/` with a `LENS.md` file:

    lenses/my-lens/LENS.md

Format:

    ---
    name: My Lens
    description: What this lens does
    icon: M          # optional, single char or emoji
    color: "#7c3aed" # optional, hex color
    model: claude-sonnet-4-6 # optional
    ---

    Your system prompt here. This defines the lens's perspective.

The lens will appear in the picker next time you start Loupe.
