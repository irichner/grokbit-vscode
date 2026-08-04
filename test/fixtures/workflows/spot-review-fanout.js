// Claude Code workflow fixture — fan a spot review out across four lenses.
//
// Committed for the same reason as review-changes.rhai: no real saved workflow
// exists to parse, so this encodes the documented script shape — a meta block
// with phases, phase() statements, and agent() calls reached through pipeline()
// and template-literal prompts.

export const meta = {
  name: 'spot-review-fanout',
  description: 'Review every rendered spot across four lenses',
  whenToUse: 'After a batch of spots renders. Budget accordingly.',
  phases: [
    { title: 'Review', detail: 'four lenses per spot' },
    { title: 'Synthesize' },
  ],
};

phase('Review');

const LENSES = ['hook', 'clarity', 'brand', 'legal'];

const reviews = await pipeline(
  LENSES,
  (lens) => agent(`Review the spot through the ${lens} lens.`, { label: 'review', phase: 'Review' }),
  () => agent('Summarize the lens verdict in one paragraph.', { model: 'haiku' }),
);

phase('Synthesize');

const final = await agent('Synthesize every lens verdict into one recommendation.', {
  label: 'synthesize',
  schema: SUMMARY_SCHEMA,
});

return { reviews, final };
