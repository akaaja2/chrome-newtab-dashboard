# Building a New Tab Dashboard in Chrome: Steps and Current Features

The New Tab Dashboard is a Chrome Extension Manifest V3 project that replaces the browser's default new tab page with a lightweight workspace. Instead of opening a blank screen, the user gets a practical dashboard with a live clock, a Pomodoro timer, reusable links, notes, a to-do list, and a few visual customisation options.

What makes the dashboard useful is that it behaves like a personal command centre rather than a static landing page. The cards can be reordered, pinned, or minimised, and most of the data survives reloads through `chrome.storage.local`.

## Why build a custom new tab page?

A new tab page is one of the most frequently seen screens in the browser. That makes it a surprisingly valuable place for small productivity gains.

Instead of letting that space go unused, the dashboard turns it into a place for:

- quick context
- task tracking
- focus sessions
- saved links
- lightweight notes
- a calm visual starting point

The result is not just a prettier browser tab. It is a small productivity surface that helps the user start work with less friction.

## Step 1: Replace the default new tab page

The first step happens at the browser level. The extension uses a Manifest V3 `chrome_url_overrides` entry to point Chrome's `newtab` page at `newtab.html`. Every time a new tab opens, Chrome loads the dashboard instead of the standard browser page.

Once that override is in place, the rest of the project can focus on the experience inside the page. The HTML structure in `newtab.html` defines the dashboard cards, `styles.css` shapes the visual design, and the JavaScript modules power the behaviour.

## Step 2: Bootstrap the dashboard safely

The next step is initialization. The `bootstrap.js` file loads the modules in a controlled order so the dashboard is ready without race conditions. It prepares the layout, then initialises the individual cards, and finally starts the live tickers for the clock and Pomodoro timer.

That order matters because the dashboard stores layout state, note content, links, tasks, background choices, and timer data. By restoring the layout first, the interface can put the cards back where the user left them before the rest of the widgets begin rendering.

## Step 3: Restore saved state

One of the strongest parts of the project is persistence. Most of the user's choices are stored in `chrome.storage.local`, including:

- favourite links
- saved dashboards
- tasks and task history
- notes
- daily earnings
- background selection
- card surface preference
- Pomodoro session state
- card order, pinned cards, and minimised cards

This makes the dashboard feel durable. A user can close the browser, reopen it later, and find the page in the same state.

## Step 4: Build the main cards

Once the page is loaded, the dashboard becomes a practical daily workspace. The current project features cover focus, reference, and lightweight tracking.

### Live clock and date

At the top of the page, the hero card shows a live 24-hour clock and a readable date. It updates every second, which gives the dashboard an immediate sense of life and helps the user orient themselves the moment a new tab opens.

### Pomodoro timer

The Pomodoro card is the dashboard's focus engine. It supports work sessions, short breaks, and long breaks. Users can start, pause, and reset the timer, switch between modes, and give each session a custom label. The card also tracks completed sessions for the day, so progress is visible instead of hidden.

There is also a useful workflow hook: a task can be dragged onto the timer to start a focus session. That connects planning and execution in a simple way and turns the new tab page into a practical work tool.

### Motivational quotes

The quote card rotates through a small set of short motivational messages automatically. It is intentionally light and non-distracting. The content is there to keep momentum moving, not to take over the page. There is also a manual next button for users who want to skip ahead.

### Favourite links

The links card supports adding, editing, and deleting saved links. Each saved item opens in a new tab, and the card tries to display a favicon for normal web links. It also supports local file links, which is a thoughtful detail for users who keep PDFs, notes, or local files in a workflow folder.

### Local dashboards, earnings, tasks, and notes

The dashboards card is designed for local HTML dashboards. It can extract a page title from a local HTML file when possible, and if not, it falls back to the file name. The earnings card tracks small jobs or platform income with GBP totals and USD conversion. The to-do list supports priorities, subtasks, and completion state, and the notes card autosaves after a short pause in typing so quick reminders are never lost.

## Step 5: Make the page feel personal

The appearance controls give the dashboard a little personality. Users can switch between built-in geometric backgrounds or upload a custom image. A separate card surface setting changes how the cards themselves look, with a choice between patterned and opaque surfaces.

The layout system also helps the page adapt to different working styles. Cards can be dragged to reorder, pinned to stay near the top, and minimised when the user wants a cleaner view.

The settings panel acts as a safe control centre. It provides reset actions for links, dashboards, tasks, notes, and the background, which makes it easy to clear only one part of the dashboard without wiping everything else.

## Current Project Snapshot

Right now, the dashboard already covers the essentials for a productive new tab page:

- time and date at a glance
- focus sessions with Pomodoro tracking
- saved links and local dashboard shortcuts
- daily earnings tracking
- a priority-based to-do list
- autosaving quick notes
- background and card surface customisation
- draggable, pinnable, minimisable layout cards

In other words, it is already a usable personal dashboard, not just a prototype. It helps the user start the day, stay focused, track work, and keep important links close at hand.

## Why it is a strong MVP

This project works well as an MVP because it solves one clear problem without trying to do everything at once. The core experience is already useful, and each feature adds value without forcing a heavy framework or backend into the stack.

That makes the dashboard easy to extend in a sensible order. New features can be added later, but the current version already delivers the main benefit: a more useful new tab page every time the browser opens.

## Closing Thought

The New Tab Dashboard works because it combines utility with a calm interface. It is simple enough to load instantly, but flexible enough to support real daily habits. The current features show a clear direction: turn the browser's most frequent blank space into something helpful, personal, and ready for work.

## Hero Image Prompt

Create a polished editorial illustration of a Chrome browser new tab dashboard on a desktop monitor. The interface should feel calm, modern, and minimal, with a large clock, to-do cards, quick links, notes, and a Pomodoro timer arranged in a clean grid. Use soft shadows, rounded corners, neutral colors with a subtle accent color, and a tasteful background gradient. The composition should look like a real productivity tool someone would want to use every day, not a generic stock mockup. Include a mouse, keyboard, and a few small desk items for context. Wide landscape format, high detail, crisp UI, web-article hero image.
