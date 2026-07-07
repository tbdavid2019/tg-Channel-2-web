# Agent Guide

This site publishes Telegram channel content as HTML, RSS, and JSON Feed.

## Canonical routes

- `/` serves the homepage. This deployment also enables `ANYCHANNEL="true"`, so the homepage includes a channel switcher.
- `/{channel}` serves a specific public Telegram channel.
- `/{channel}/posts/{id}` serves a single post for that channel.
- `/{channel}/links` serves configured outbound links for that channel context.

## Feeds

- `/rss.xml` and `/rss.json` expose the default channel feed.
- `/{channel}/rss.xml` and `/{channel}/rss.json` expose feeds for a specific channel.
- RSS and JSON feeds accept `?tag=<tag>` to filter by tag.

## Crawling policy

- General web crawling is allowed.
- AI training crawlers are disallowed in `robots.txt`.
- AI preference hints are published via `Content-Signal` in `robots.txt`.
