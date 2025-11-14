import type { AcceptableSlot, MemberInfo, SortClassMembersConfig } from "../types";

/**
 * checks if members are in correct order and - if not - will update their scores
 *
 * this is done so that the scores of the getter/setters have enough distance to put the private fields between them
 * e.g. the public accessibility of zIndex makes this the correct order here (using default settings)
 * ```
 * class Foo {
 *   #zIndex: number
 *   public get zIndex(): number {...}
 *   #bounds: [number, number]
 *   private get bounds(): [number, number] {...}
 * }
 * ```
 * to accomplish this, we group all into the same group index but increment the score of `bounds` by 10
 * then each private field is set to `getter.slot.score-1` such that.
 *
 * `#zIndex: 9, zIndex:10, #bounds:19, bounds: 20`
 */
export const areMembersInCorrectOrder = (
    first: MemberInfo,
    second: MemberInfo,
    options: SortClassMembersConfig,
): boolean => {
    const collator = new Intl.Collator(options.locale);
    if (first.acceptableSlots === undefined) return false;

    return first.acceptableSlots.some((a) => {
        if (second.acceptableSlots === undefined) return true;

        return second.acceptableSlots.some((b) => {
            if (a.index !== b.index) return a.index < b.index;
            if (a.score !== b.score) return a.score < b.score;

            // alphabetical within group
            if (options.alphabetical || areSlotsAlphabeticallySorted(a, b)) {
                // return collator.compare(first.name, second.name) <= 0;

                if (collator.compare(first.name, second.name) <= 0) {
                    b.score = a.score + 10;
                    return true;
                } else {
                    a.score = b.score + 10;
                    return false;
                }
            }

            // if nothing else triggers, we assume the order is fine
            // TODO: i'd rather be opinionated
            return true;
        });
    });
};

// TODO: add a global override?
const areSlotsAlphabeticallySorted = (a: AcceptableSlot, b: AcceptableSlot): boolean =>
    a.sort === "alphabetical" && b.sort === "alphabetical";
