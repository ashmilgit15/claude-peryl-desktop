# Project: Claude Desktop UI Enhancement

## Architecture
The application is a desktop Claude client interface built with Python (PyQt6 window embedding QWebEngineView or local browser/webview) and an HTML/CSS/JS frontend located in `static/`.
- `main.py`: PyQt6 application window, launcher entry, web engine/window setup.
- `static/index.html`: Main web app HTML layout (header, chat messages stream, floating input card, thinking loader).
- `static/styles.css`: CSS styling for header bar, chat title dropdown, action toolbar, message bubbles, paragraph line-height (`1.6`), max-width (`760px`), floating input card (`18px` rounded corners), thinking block.
- `static/app.js`: Client-side logic for message rendering, animated terracotta starburst sunflower spinner, thinking verb cycling (`Pondering...`, `Musing...`, `Flabbergasting...`, `Enchanting...`, `Deliberating...`, `Contemplating...`, `Synthesizing...`), collapsible thinking reasoning block component (`Thought for X seconds` / `View thinking process`).
- `claude-peryl.desktop`: Linux desktop application launcher file (`Icon=/home/ashmilp/proxy/static/logo.png`).
- `static/logo.svg` & `static/logo.png`: High-resolution application launcher logo assets.

## Code Layout
- Frontend: `static/index.html`, `static/styles.css`, `static/app.js`
- Assets: `static/logo.svg`, `static/logo.png`
- Python / Desktop: `main.py`, `agent_engine.py`, `system_prompt.py`, `claude-peryl.desktop`

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|--------|
| M1 | Desktop Launcher Icon | R3: PNG icon generation, desktop launcher entry, PyQt6 setWindowIcon | None | PLANNED |
| M2 | UI Spacing & Header Alignment | R1: Header top bar alignment, message bubble margins & paragraph line-height, floating input card styling | None | PLANNED |
| M3 | Custom Thinking Effects & Extended Reasoning | R2: Terracotta starburst spinner, dynamic thinking phrases cycling, collapsible thinking block | None | PLANNED |
| M4 | E2E Integration & Verification | E2E test verification, visual layout compliance, forensic audit | M1, M2, M3 | PLANNED |

## Interface Contracts
### PyQt6 Window ↔ Assets
- `main.py` sets application window icon: `self.setWindowIcon(QIcon("static/logo.png"))` (or full path / relative path as configured).
- `claude-peryl.desktop` specifies `Icon=/home/ashmilp/proxy/static/logo.png`.
- `static/logo.png` is generated directly from `static/logo.svg`.
