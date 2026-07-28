# Execution Plan: Claude Desktop UI Enhancement

## Phase 1: Exploration & Codebase Analysis
- [ ] Spawn 3 Explorer agents (`explorer_1`, `explorer_2`, `explorer_3`) to analyze existing codebase:
  - `explorer_1`: Analyze Desktop Launcher & Icon setup (`main.py`, `claude-peryl.desktop`, `static/logo.svg`, `static/logo.png`).
  - `explorer_2`: Analyze UI Spacing & Header layout (`static/index.html`, `static/styles.css`).
  - `explorer_3`: Analyze Thinking Block loader, animations, dynamic phrase cycling logic, and DOM stream handling (`static/app.js`, `static/styles.css`).
- [ ] Synthesize explorer reports into actionable worker directives.

## Phase 2: Milestone Execution

### Milestone 1: Desktop Launcher Icon (R3)
- [ ] Dispatch Worker to:
  1. Convert/generate high-resolution PNG (`static/logo.png`) from `static/logo.svg`.
  2. Update `claude-peryl.desktop` with `Icon=/home/ashmilp/proxy/static/logo.png`.
  3. Ensure `main.py` sets PyQt6 window icon `self.setWindowIcon(QIcon("static/logo.png"))`.
  4. Run build/test check.
- [ ] Review & Verification: Spawn Reviewer, Challenger, and Forensic Auditor to confirm logo artifact, desktop entry, and PyQt window icon setup.

### Milestone 2: UI Spacing & Header Alignment (R1)
- [ ] Dispatch Worker to update `static/styles.css` and `static/index.html` for:
  1. Header top bar alignment with hamburger menu `≡`, chat title dropdown, document viewer `📄`, and Share `↗ Share` button.
  2. Message bubble margins, assistant paragraph line-height (`1.6`), max-width (`760px`), and action toolbar icon spacing (`📋`, `🔊`, `👍`, `👎`, `🔄`).
  3. Floating input card margins, rounded corners (`18px`), bottom controls (`+`, model dropdown, mic `🎙️`, equalizer wave `≡`, send button `↑`).
- [ ] Review & Verification: Spawn Reviewer, Challenger, and Forensic Auditor to verify exact spacing, margins, and CSS properties.

### Milestone 3: Custom Thinking Effects & Extended Reasoning (R2)
- [ ] Dispatch Worker to update `static/app.js`, `static/styles.css`, and `static/index.html`:
  1. Add animated terracotta starburst sunflower spinner with dynamic phrase cycling (`Pondering...`, `Musing...`, `Flabbergasting...`, `Enchanting...`, `Deliberating...`, `Contemplating...`, `Synthesizing...`).
  2. Add collapsible Thinking Block component (`Thought for X seconds` / `View thinking process`) that expands to reveal inner reasoning steps.
- [ ] Review & Verification: Spawn Reviewer, Challenger, and Forensic Auditor to verify phrase cycling timer, animation, and collapsible functionality.

### Milestone 4: E2E Integration & Acceptance Audit
- [ ] Comprehensive verification across all 3 Acceptance Criteria.
- [ ] Final Forensic Auditor verification.
- [ ] Report final results to Sentinel.
