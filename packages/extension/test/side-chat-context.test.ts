import { describe, expect, it } from 'vitest';
import { createSnapshot, MAX_SIDE_CHAT_CONTEXT, snapshotPrompt } from '../src/side-chat/context.js';

describe('Side Chat reviewed page snapshots', () => {
  it('bounds a large loaded conversation and discloses truncation', () => {
    const snapshot = createSnapshot('https://example.com/chat', 'Loaded conversation', 'x'.repeat(MAX_SIDE_CHAT_CONTEXT + 10));
    expect(snapshot.text.length).toBe(MAX_SIDE_CHAT_CONTEXT);
    expect(snapshot.truncated).toBe(true);
  });
  it('keeps provenance and the exact reviewed text, including code and tables', () => {
    const snapshot = createSnapshot('https://example.com/chat', 'Conversation', 'const count = 3;\nName\tValue\ncount\t3');
    const prompt = snapshotPrompt(snapshot);
    expect(prompt).toContain(snapshot.url);
    expect(prompt).toContain(snapshot.text);
    expect(prompt).toContain('untrusted reference material');
    snapshot.text = 'User removed the table';
    expect(snapshotPrompt(snapshot)).not.toContain('count\t3');
    expect(snapshotPrompt(snapshot)).toContain('User removed the table');
  });
  it('does not introduce hidden context after the user clears it', () => {
    expect(snapshotPrompt(undefined)).toBe('');
    expect(snapshotPrompt(createSnapshot('https://example.com', 'Empty', '  '))).toBe('');
  });
});
