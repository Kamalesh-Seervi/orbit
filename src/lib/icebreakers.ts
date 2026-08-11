/** Conversation starters shown on connect and after a lull in the chat. */
export const ICEBREAKERS: string[] = [
  'What is something you are irrationally passionate about?',
  'Tea or coffee — and how do you take it?',
  'What is the best thing that happened to you this week?',
  'If you could teleport anywhere right now, where would you go?',
  'What song is stuck in your head lately?',
  'Cats, dogs, or something more exotic?',
  'What is a small thing that instantly makes your day better?',
  'What are you watching or reading at the moment?',
  'Beach sunrise or mountain sunset?',
  'What is a skill you would love to learn?',
  'What is the last thing that made you laugh out loud?',
  'If money were no object, what would you do all day?',
  'Sweet or savoury? Defend your answer.',
  'What is your comfort meal?',
  'Where in the world are you right now — roughly?',
  'What is an underrated way to spend a weekend?',
];

/** Emoji available in the floating reaction tray. */
export const REACTION_EMOJIS = ['❤️', '😂', '😮', '👍', '🔥', '👋', '✨', '🎉'];

/** Suggested interest tags surfaced in the lobby chip picker. */
export const SUGGESTED_INTERESTS = [
  'music',
  'gaming',
  'movies',
  'travel',
  'art',
  'coding',
  'sports',
  'books',
  'food',
  'photography',
  'fitness',
  'anime',
  'crypto',
  'startups',
  'languages',
  'pets',
];

export function pickIcebreaker(exclude?: string): string {
  const pool = exclude ? ICEBREAKERS.filter((p) => p !== exclude) : ICEBREAKERS;
  return pool[Math.floor(Math.random() * pool.length)];
}
