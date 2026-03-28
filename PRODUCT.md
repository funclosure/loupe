# Loupe

A writing tool where AI companions sit beside your text and offer different ways of seeing it.

## The Idea

A loupe is a small magnifying lens — jewelers hold one up to see what's invisible to the naked eye. In this app, each "lens" is a perspective you can summon while writing: a philosopher, a thinking framework, a practical editor, or anything you define.

You write in a distraction-free surface. When you want a different angle on what you've written, you summon a lens. It floats alongside your text like a colleague reading over your shoulder — not interrupting, but available when you turn to it.

## How It Works

**Writing.** A centered markdown editor. Serif font, warm dark theme, nothing else. You open a `.md` file or start from blank. Auto-saves to disk. Zen mode hides all chrome.

**Lenses.** Each lens is a persona or framework defined by a system prompt. You activate one from the picker (Cmd+L), and it appears as a floating bubble in the margin. Click the bubble to open a chat — ask it to review your text, focus on a paragraph, or just think aloud.

Lenses see your full document. When you say "what do you think?", they respond through their specific frame: Heidegger talks about Dasein, the Devil's Advocate pokes holes, the Empathetic Reader tells you where they got lost.

**Your lenses.** Create a folder in `lenses/` with a `LENS.md` file — a name, a color, and a system prompt. That's it. Your lens shows up in the picker next time you start.

## What It's Not

- Not a collaborative editor (the "multiplayer" is with AI, not people)
- Not a note-taking system (one file at a time, no folders or linking)
- Not a chatbot wrapper (the lenses are companions to writing, not general assistants)

## Built With

Bun, React, Milkdown (ProseMirror), Claude Agent SDK. Runs locally — your writing stays on your machine, AI calls go through your Claude Code session.
