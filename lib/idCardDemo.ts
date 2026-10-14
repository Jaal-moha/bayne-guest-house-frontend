// Temporary client demo of ID card options. Delete with the demo page once the client picks.

export type IdCardOptions = {
  photo: 'passport' | 'compact';
  back: 'white' | 'tint';
  wordmark: string;
  perPage: 1 | 3;
};

export const DEFAULT_ID_CARD_OPTIONS: IdCardOptions = {
  photo: 'passport',
  back: 'white',
  wordmark: 'ALMIS HOTEL',
  perPage: 1,
};

export const WORDMARK_MAX = 24;

type Choice<V> = { value: V; label: string; summary: string; tradeoff: string };
type ChoiceGroup<K extends 'photo' | 'back' | 'perPage'> = {
  key: K;
  label: string;
  summaryLabel: string;
  choices: readonly Choice<IdCardOptions[K]>[];
};

export const PHOTO_GROUP: ChoiceGroup<'photo'> = {
  key: 'photo',
  label: 'Photo',
  summaryLabel: 'Photo',
  choices: [
    { value: 'passport', label: 'Passport 35 x 45 mm', summary: 'passport', tradeoff: 'Biggest face, nothing else fits.' },
    { value: 'compact', label: 'Compact 25 x 32 mm', summary: 'compact', tradeoff: 'Room for the phone number.' },
  ],
};

export const BACK_GROUP: ChoiceGroup<'back'> = {
  key: 'back',
  label: 'Back',
  summaryLabel: 'Back',
  choices: [
    { value: 'white', label: 'White', summary: 'white', tradeoff: 'Cheapest ink, front and back look alike once cut.' },
    { value: 'tint', label: 'Tinted', summary: 'tinted', tradeoff: 'Easy to tell sides apart, a little more ink.' },
  ],
};

export const PER_PAGE_GROUP: ChoiceGroup<'perPage'> = {
  key: 'perPage',
  label: 'Cards per A4',
  summaryLabel: 'Per page',
  choices: [
    { value: 1, label: '1', summary: '1', tradeoff: 'Simple, wastes two thirds of the page.' },
    { value: 3, label: '3', summary: '3', tradeoff: 'Prints a batch, needs staff picked below.' },
  ],
};

export function wordmarkOf(raw: string): string {
  return raw.trim().slice(0, WORDMARK_MAX).toUpperCase() || DEFAULT_ID_CARD_OPTIONS.wordmark;
}

const summaryOf = <K extends 'photo' | 'back' | 'perPage'>(group: ChoiceGroup<K>, options: IdCardOptions) =>
  `${group.summaryLabel}: ${group.choices.find((c) => c.value === options[group.key])?.summary}`;

export function summaryLine(options: IdCardOptions): string {
  return [
    summaryOf(PHOTO_GROUP, options),
    summaryOf(BACK_GROUP, options),
    summaryOf(PER_PAGE_GROUP, options),
    `Wordmark: ${wordmarkOf(options.wordmark)}`,
  ].join(' · ');
}

export function demoQuery(options: IdCardOptions, staffIds: readonly number[]): string {
  return new URLSearchParams({
    ids: staffIds.join(','),
    photo: options.photo,
    back: options.back,
    wordmark: wordmarkOf(options.wordmark),
    perPage: String(options.perPage),
  }).toString();
}
