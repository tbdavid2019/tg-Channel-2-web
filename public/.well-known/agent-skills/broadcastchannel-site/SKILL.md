---
name: broadcastchannel-site
description: Discover Telegram channel posts, feeds, and links from telegram.david888.com. Use when you need public channel content from this site.
---

# BroadcastChannel Site

## When to use

Use this skill when you need to read public Telegram channel content from `https://telegram.david888.com`.

## Routes

- `/` is the homepage and includes a channel switcher because this deployment enables `ANYCHANNEL="true"`.
- `/{channel}` serves a specific public Telegram channel.
- `/{channel}/posts/{id}` serves a single post page.
- `/{channel}/links` serves configured outbound links.

## Feeds

- `/rss.xml` and `/rss.json` are the default channel feeds.
- `/{channel}/rss.xml` and `/{channel}/rss.json` are per-channel feeds.
- Feed endpoints accept `?tag=<tag>` to filter by tag.

## Notes

- Prefer RSS or JSON Feed when you need machine-readable updates.
- Use HTML pages when you need rendered content or navigation links.
