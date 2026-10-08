export const STEPS = ['guest', 'stay', 'review'] as const;
export type FlowStep = (typeof STEPS)[number];

export type GuestDraft = { name: string; phone: string; email: string };

export type GuestChoice =
  | { kind: 'existing'; guestId: number | null }
  | { kind: 'new'; draft: GuestDraft };

export type Stay = { checkIn: string; checkOut: string; roomId: number | null };

export type FieldName = 'guestId' | keyof GuestDraft | keyof Stay;
export type FieldErrors = Partial<Record<FieldName, string>>;

export type SubmitState =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'failed'; message: string };

export type FlowState = {
  step: FlowStep;
  guest: GuestChoice;
  // The guest this flow already created. It outlives a switch between
  // existing and new, so a retry PATCHes it instead of posting a duplicate.
  createdGuestId: number | null;
  stay: Stay;
  errors: FieldErrors;
  submit: SubmitState;
};

export type FlowAction =
  | { type: 'chooseGuestKind'; kind: GuestChoice['kind'] }
  | { type: 'pickGuest'; guestId: number | null }
  | { type: 'editDraft'; field: keyof GuestDraft; value: string }
  | { type: 'editDate'; field: 'checkIn' | 'checkOut'; value: string; today: string }
  | { type: 'pickRoom'; roomId: number | null }
  | { type: 'next'; today: string }
  | { type: 'back' }
  | { type: 'submitStarted' }
  | { type: 'guestSaved'; guestId: number }
  | { type: 'submitFailed'; message: string };

const EMPTY_DRAFT: GuestDraft = { name: '', phone: '', email: '' };

export const initialFlow: FlowState = {
  step: 'guest',
  guest: { kind: 'existing', guestId: null },
  createdGuestId: null,
  stay: { checkIn: '', checkOut: '', roomId: null },
  errors: {},
  submit: { kind: 'idle' },
};

export function todayYMD(now = new Date()): string {
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${m}-${d}`;
}

export function nights({ checkIn, checkOut }: Stay): number {
  return Math.round((Date.parse(checkOut) - Date.parse(checkIn)) / 86_400_000);
}

// Errors for the dates already entered. Shown as the user types, so a past or
// zero-night stay is flagged before any request goes out.
export function dateErrors({ checkIn, checkOut }: Stay, today: string): FieldErrors {
  const errors: FieldErrors = {};
  if (checkIn && checkIn < today) errors.checkIn = "Check-in can't be in the past.";
  if (checkIn && checkOut && checkOut <= checkIn) errors.checkOut = 'Check-out must be at least one night after check-in.';
  return errors;
}

export function guestErrors(guest: GuestChoice): FieldErrors {
  if (guest.kind === 'existing') return guest.guestId === null ? { guestId: 'Pick a guest.' } : {};
  const { name, phone, email } = guest.draft;
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = 'Enter the guest name.';
  if (phone.trim().length < 3) errors.phone = 'Enter a phone number.';
  if (email.trim() && !/^\S+@\S+\.\S+$/.test(email.trim())) errors.email = 'Enter a valid email or leave it blank.';
  return errors;
}

export function stayErrors(stay: Stay, today: string): FieldErrors {
  const errors = dateErrors(stay, today);
  if (!stay.checkIn) errors.checkIn = 'Pick a check-in date.';
  if (!stay.checkOut) errors.checkOut ??= 'Pick a check-out date.';
  if (stay.roomId === null) errors.roomId = 'Pick a room.';
  return errors;
}

const isEmpty = (errors: FieldErrors) => Object.keys(errors).length === 0;

function without(errors: FieldErrors, ...fields: FieldName[]): FieldErrors {
  return Object.fromEntries(Object.entries(errors).filter(([k]) => !fields.includes(k as FieldName)));
}

export function flowReducer(state: FlowState, action: FlowAction): FlowState {
  switch (action.type) {
    case 'chooseGuestKind':
      if (state.guest.kind === action.kind) return state;
      return {
        ...state,
        guest: action.kind === 'existing' ? { kind: 'existing', guestId: null } : { kind: 'new', draft: EMPTY_DRAFT },
        errors: {},
      };
    case 'pickGuest':
      if (state.guest.kind !== 'existing') return state;
      return { ...state, guest: { kind: 'existing', guestId: action.guestId }, errors: without(state.errors, 'guestId') };
    case 'editDraft':
      if (state.guest.kind !== 'new') return state;
      return {
        ...state,
        guest: { kind: 'new', draft: { ...state.guest.draft, [action.field]: action.value } },
        errors: without(state.errors, action.field),
      };
    case 'editDate': {
      const stay = { ...state.stay, [action.field]: action.value, roomId: null };
      const rest = without(state.errors, 'checkIn', 'checkOut', 'roomId');
      return { ...state, stay, errors: { ...rest, ...dateErrors(stay, action.today) } };
    }
    case 'pickRoom':
      return { ...state, stay: { ...state.stay, roomId: action.roomId }, errors: without(state.errors, 'roomId') };
    case 'next': {
      if (state.step === 'review') return state;
      const errors = state.step === 'guest' ? guestErrors(state.guest) : stayErrors(state.stay, action.today);
      if (!isEmpty(errors)) return { ...state, errors };
      return { ...state, step: STEPS[STEPS.indexOf(state.step) + 1], errors: {}, submit: { kind: 'idle' } };
    }
    case 'back':
      if (state.step === 'guest' || state.submit.kind === 'saving') return state;
      return { ...state, step: STEPS[STEPS.indexOf(state.step) - 1], errors: {}, submit: { kind: 'idle' } };
    case 'submitStarted':
      return { ...state, submit: { kind: 'saving' } };
    case 'guestSaved':
      return { ...state, createdGuestId: action.guestId };
    case 'submitFailed':
      return { ...state, submit: { kind: 'failed', message: action.message } };
  }
}

export type GuestBody = { name: string; phone: string; email?: string };
export type BookingBody = { guestId: number; roomId: number; checkIn: string; checkOut: string };

export type SubmitPlan =
  | { kind: 'invalid'; step: FlowStep; errors: FieldErrors }
  | {
      kind: 'ready';
      guest:
        | { kind: 'existing'; guestId: number }
        | { kind: 'save'; method: 'POST' | 'PATCH'; path: string; body: GuestBody };
      booking: (guestId: number) => BookingBody;
    };

// What the review step's Create button sends. Re-validates both steps so a
// stale date (the day rolled over while the modal sat open) still can't post.
export function planSubmit(state: FlowState, today: string): SubmitPlan {
  const gErrors = guestErrors(state.guest);
  if (!isEmpty(gErrors)) return { kind: 'invalid', step: 'guest', errors: gErrors };
  const sErrors = stayErrors(state.stay, today);
  const { checkIn, checkOut, roomId } = state.stay;
  if (!isEmpty(sErrors) || roomId === null) return { kind: 'invalid', step: 'stay', errors: sErrors };

  const booking = (guestId: number): BookingBody => ({ guestId, roomId, checkIn, checkOut });
  if (state.guest.kind === 'existing') {
    const { guestId } = state.guest;
    if (guestId === null) return { kind: 'invalid', step: 'guest', errors: gErrors };
    return { kind: 'ready', guest: { kind: 'existing', guestId }, booking };
  }
  const { name, phone, email } = state.guest.draft;
  const body: GuestBody = { name: name.trim(), phone: phone.trim(), ...(email.trim() ? { email: email.trim() } : {}) };
  const save = state.createdGuestId === null
    ? { kind: 'save' as const, method: 'POST' as const, path: '/guests', body }
    : { kind: 'save' as const, method: 'PATCH' as const, path: `/guests/${state.createdGuestId}`, body };
  return { kind: 'ready', guest: save, booking };
}
