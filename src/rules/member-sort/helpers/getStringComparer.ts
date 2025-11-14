type ReturnType =  (s: string) => boolean

export const getStringComparer = (str?: string): ReturnType => {
    if (str === undefined) {
        return () => true;
    }

    // is regex pattern
    if (str.startsWith("/")) {
        let strPattern = str.substring(1, str.length - 1);
        if (!strPattern.startsWith("^")) strPattern = `^${strPattern}`;
        if (!strPattern.endsWith("$")) strPattern += "$";
        const re = new RegExp(strPattern);
        return (s) => re.test(s);
    }
    return (s) => s === str;
};
