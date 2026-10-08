import type { AgenticRouteInput, AgenticRoutePlan } from '@codex-sidepanel/shared';

/** Side Chat already has a reviewed snapshot: no extra routing agent or page reads. */
export function createSideChatRoute(input: AgenticRouteInput): AgenticRoutePlan {
  return {
    version: 1, source: 'fallback', task: 'general',
    contextMode: input.fileAttachments.length ? 'files-only' : 'none',
    contextRequests: [], structuredInputIds: [], historyQuery: '', requiresVision: false,
    pageReadStrategy: 'dom',
    intent: { summary: 'Answer the side-chat question', action: 'answer', target: 'conversation', constraints: ['Use the reviewed snapshot'], needsClarification: false },
    selectedProfileId: input.selectedProfileId, selectedModel: input.selectedModel,
    imageEdit: { shouldEdit: false, target: 'none', reason: 'Side Chat is a question-and-answer workflow' },
    browserControl: { shouldControl: false, mode: 'dom', surface: 'active-tab', reason: 'Keep the source website unchanged' },
    notes: ['Use the explicit snapshot; do not collect implicit webpage context.'], confidence: 1,
  };
}
