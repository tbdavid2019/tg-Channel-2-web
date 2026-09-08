# Agent Guide

> Technical Provider: [david888.com](https://david888.com/)

This site publishes Telegram channel content as HTML, RSS, JSON Feed, and provides in-browser AI tool calling via **WebMCP (Web Model Context Protocol)**.

## WebMCP (Web Model Context Protocol)

This website implements the Chrome and W3C [WebMCP specification](https://developer.chrome.com/docs/ai/webmcp). In-browser AI agents (such as Chrome AI, Gemini, Claude, or Copilot) can directly discover and invoke tools registered via `document.modelContext`, `navigator.modelContext`, and `window.__webmcp`:

- `navigate-channel`: Navigate to any public Telegram channel by username or URL.
- `search-articles`: Search posts, messages, or tags across the channel.
- `get-random-channel`: Fetch a random curated channel recommendation as JSON without page reload.
- `navigate-random-channel`: Directly navigate to a random curated channel.
- `switch-language`: Switch interface language between `zh-Hant` and `en`.
- `get-current-channel-info`: Extract structured metadata, RSS, and JSON Feed endpoints.
- `filter-by-date`: Filter posts by specific date (`YYYY-MM-DD`).

## Canonical routes

- `/` serves the homepage with input form and channel switcher.
- `/{channel}` serves a specific public Telegram channel.
- `/{channel}/posts/{id}` serves a single post for that channel.
- `/{channel}/date/{YYYY-MM-DD}` serves posts filtered by date.
- `/random` performs a 302 redirect to a random curated channel.
- `/random?json=1` returns a random channel recommendation in JSON format.
- `/search/{keyword}` searches posts and tags.

## Feeds

- `/rss.xml` and `/rss.json` expose the default channel feed.
- `/{channel}/rss.xml` and `/{channel}/rss.json` expose feeds for a specific channel.
- RSS and JSON feeds accept `?tag=<tag>` to filter by tag.

## Crawling policy

- General web crawling is allowed.
- AI training crawlers are disallowed in `robots.txt`.
- AI preference hints are published via `Content-Signal` in `robots.txt`.
