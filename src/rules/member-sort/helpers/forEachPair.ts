export const forEachPair = <T>(
    list: T[],
    callback: (first: T, second: T, firstIndex: number, secondIndex: number) => void,
): void => {
    list.forEach((first, firstIndex) => {
        list.slice(firstIndex + 1).forEach((second, secondIndex) => {
            callback(first, second, firstIndex, firstIndex + secondIndex + 1);
        });
    });
};
