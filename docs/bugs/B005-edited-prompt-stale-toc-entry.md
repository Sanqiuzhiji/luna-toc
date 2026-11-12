# B005 — Edited Prompt Leaves Stale TOC Entry

## Symptom

After sending a prompt, stopping the response, editing that prompt, and
resending it, LunaTOC displayed both the stopped version and the edited version.

## Source-Level Diagnosis

Each edited send has a new user-message ID. Live capture forwarded only that
message, so `ConversationStore` treated it as a separate pending prompt. Exact
ID deduplication could not connect the versions, and a stopped assistant turn
prevented the consecutive-user collapse rule from identifying the replacement.

## Fix

Forward the request-level `parent_message_id` with outgoing prompts. Keep a
route-scoped parent-to-prompt map and treat different user IDs with the same
parent as edited siblings. Remove the earlier sibling from raw, pending,
confirmed, cached, and active projections, then suppress its late network or
DOM events. Move both maps through temporary conversation route promotion.

## Verification

Vitest covers stopped-response replacement, stale live and GET events, distinct
rapid prompts, and temporary-route migration. Real ChatGPT acceptance remains
required because the production request contract is controlled by the host.
