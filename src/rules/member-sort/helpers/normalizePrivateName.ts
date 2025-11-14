/**
 * compute the normalized name of a property
 * @param name a variation of `_foo` `#foo` `_#foo` `__foo`
 * @returns the canonical base name in the form of `foo`
 */
export const normalizePrivateName = (name: string): string => name.replace(/^(#|_){1,2}/, "");
