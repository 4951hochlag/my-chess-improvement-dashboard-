# My Chess Improvement Dashboard v0.4

Open `index.html` in Chrome. Use the Chessable tab > Import JSON to import a fresh export from Chessable Tracker v0.5.2. Course cover images appear when the exported records include a usable cover URL; otherwise a chess-piece placeholder is shown. Course names always appear. Titles link to Chessable only if the export contains an individual course URL (a profile link is not treated as a course link).

The light/dark mode toggle is in the top right and remembers your selection in the same browser. Your existing saved statuses and tags are preserved by the dashboard's import logic. For safety, export your current dashboard JSON before replacing an older version.

Note: local browser storage may differ when opening the file from a different folder. If you don't see your earlier changes, import your dashboard backup JSON. This package includes the v0.3 course and weekly activity data as a starting point.


v0.4.1: Deduplicates saved courses on startup and import, including tracker title variants; retains cover URLs, tags and manual statuses. Export a backup before importing.
