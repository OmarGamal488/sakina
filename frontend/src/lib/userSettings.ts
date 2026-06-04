export const USER_EMAIL_KEY = 'sakina_user_email'
export const TRUSTED_PERSON_EMAIL_KEY = 'sakina_trusted_person_email'
export const USER_NAME_KEY = 'sakina_user_name'

function readTrimmed(key: string): string {
  return localStorage.getItem(key)?.trim() ?? ''
}

export function getSavedUserEmail(): string {
  return readTrimmed(USER_EMAIL_KEY)
}

export function getSavedTrustedPersonEmail(): string {
  return readTrimmed(TRUSTED_PERSON_EMAIL_KEY)
}

export function getSavedUserName(): string {
  return readTrimmed(USER_NAME_KEY)
}
