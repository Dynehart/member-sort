export class A {
    #b?: number;
    public get b(): number {
        this.#b ??= 0;
        return this.#b;
    }

    // comment
    #a?: number;
    public get a(): number {
        this.#a ??= 1;
        return this.#a;
    }
}