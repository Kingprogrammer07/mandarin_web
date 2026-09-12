/**
 * Who a manager-filed parcel goes to.
 *
 * A client with a lot of cargo sends parcels to other people, so the manager
 * either keeps the account holder's name or types the recipient's. The phone
 * starts as the profile phone and is always sent explicitly: a cleared field is
 * a mistake to point out, not a silent fallback to the account holder's number
 * for somebody else's parcel.
 */

/** Longest name the backend accepts (`delivery_recipient.RECIPIENT_NAME_MAX_LENGTH`). */
export const RECIPIENT_NAME_MAX_LENGTH = 120;

/** Longest phone the admin endpoints accept (`phone_number`, max_length=32). */
export const RECIPIENT_PHONE_MAX_LENGTH = 32;

export interface RecipientDraft {
  /** The account holder's name from the client's profile. */
  profileName: string;
  /** The typed name, or null while the profile name is used. */
  typedName: string | null;
  phone: string;
}

export type RecipientProblem =
  | "name-missing"
  | "name-too-long"
  | "name-formula"
  | "phone-missing"
  | "phone-too-long";

export interface RecipientPayload {
  /** Present only when a name other than the profile name was typed. */
  recipient_name?: string;
  phone_number: string;
}

/**
 * Cleans a typed name the way the backend does before storing it
 * (`clean_recipient_name`): compatibility forms folded, invisible format
 * characters dropped, control characters and runs of whitespace collapsed to one
 * space. Mirroring it keeps the page from sending a name the server would reduce
 * to nothing.
 */
export function normalizeRecipientName(value: string): string {
  return value
    .normalize("NFKC")
    .replace(/\p{Cf}/gu, "")
    .replace(/\p{Cc}/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * What stops this recipient from being submitted, in display order.
 *
 * The name rules apply to a typed name only, as on the server: the profile name
 * is stored as the client saved it. Choosing "another name" and leaving it empty
 * is a problem rather than a quiet return to the profile name, because the
 * manager chose it for someone else.
 */
export function recipientProblems(draft: RecipientDraft): RecipientProblem[] {
  const problems: RecipientProblem[] = [];

  if (draft.typedName === null) {
    if (!normalizeRecipientName(draft.profileName)) problems.push("name-missing");
  } else {
    const typed = normalizeRecipientName(draft.typedName);
    if (!typed) problems.push("name-missing");
    else if (typed.length > RECIPIENT_NAME_MAX_LENGTH) problems.push("name-too-long");
    else if (typed.startsWith("=")) problems.push("name-formula");
  }

  const phone = draft.phone.trim();
  if (!phone) problems.push("phone-missing");
  else if (phone.length > RECIPIENT_PHONE_MAX_LENGTH) problems.push("phone-too-long");

  return problems;
}

/** The request fields for this recipient. Call only when there are no problems. */
export function toRecipientPayload(draft: RecipientDraft): RecipientPayload {
  const phone_number = draft.phone.trim();
  if (draft.typedName === null) return { phone_number };

  const typed = normalizeRecipientName(draft.typedName);
  const sameAsProfile =
    typed.toLocaleLowerCase() ===
    normalizeRecipientName(draft.profileName).toLocaleLowerCase();

  return sameAsProfile ? { phone_number } : { recipient_name: typed, phone_number };
}
