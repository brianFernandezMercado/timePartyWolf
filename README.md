# Wolf Party Tetris

This package restores the original party page and adds a self-contained Tetris mini-game.

## Install
- Replace your `index.html` with the included version.
- Place `tetris.js` beside `index.html`.
- No build step or external dependency is required.

## Controls
- Left/Right or A/D: move
- Down or S: soft drop
- Up or X: rotate clockwise
- Z: rotate counter-clockwise
- Space: hard drop
- C or Shift: hold
- P or Escape: pause

## Features
- 10x20 classic board, 7 tetrominoes, ghost piece, next/hold previews.
- Scoring, combos, levels and local best score.
- Line-clear particles and flash effects.
- Two-line clear triggers a stronger cabinet rumble and layered sound effect.
- Mobile touch controls.


## Firebase Leaderboard Setup

Enable **Authentication → Sign-in method → Anonymous** and create Firestore Database. Publish these rules:

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /players/{playerId} {
      allow read: if request.auth != null;
      allow create, update: if request.auth != null && playerId == request.auth.uid && request.resource.data.playerId == request.auth.uid;
      allow delete: if false;
    }
  }
}
```

Client-side scores are not server-validated. These rules restrict each anonymous user to their own document, but a technically savvy participant could manipulate their score. For prize-grade integrity, validate score submissions through a Cloud Function/server.


## Player entry modal
On page load, the player entry modal asks for a name and registers it in Firebase before scrolling to Tetris. The browser-specific code remains saved locally so the same browser keeps its player code.


## Chaos Mode Additions
- Random extra pieces: P, U, W, 3x3 mega block and cross block.
- Special-piece lock effects, screen pulse and stronger shake.
- Level-dependent special-piece probability.
- Faster progression and higher speed cap.
- Random earthquakes starting at level 3.
- Glitch strips, expanded particles, cabinet shake and screen shake on clears.
