# Telegram Sheet Webhook Proxy

A tiny webhook proxy for Telegram -> Google Apps Script.

Telegram requires a direct 2xx response. Google Apps Script web apps answer POST requests with an HTTP 302 after executing the script. This service forwards the Telegram update to Apps Script without following the redirect, then returns HTTP 200 to Telegram.
