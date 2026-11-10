# B004 — New Prompt Misses Immediate TOC Update

## Symptom

In an existing ChatGPT conversation, a newly submitted user message can appear
in the chat while the LunaTOC entry arrives later or only after a refresh.

## Source-Level Diagnosis

The page hook recognized one send endpoint and only parsed a string
`init.body`. A `Request` carrying its own JSON body therefore skipped the
immediate outgoing capture. SSE capture depended on an `input_message` event.
There was no DOM fallback for a user bubble already mounted in the page.
The Store and renderer already update promptly when given a valid live message.

## Fix

Read a cloned `Request` body when `init.body` is absent, take the latest user
message, and recognize both known conversation POST paths. Observe additions
inside the ChatGPT thread only when a user node has a message ID and text.
Route network and DOM captures through one controller handler and the existing
ID-based Store deduplication. Insert late live messages by timestamp.

## Verification

Automated tests cover Request parsing, partial DOM mounts, rapid messages,
deduplication, order, and controller-to-TOC rendering. Real ChatGPT and Edge
acceptance remain pending; the exact production request shape is unconfirmed.
