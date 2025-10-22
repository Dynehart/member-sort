export class A {
    // comment
    #a?: number;

    #b?: number;
    public get b(): number {
        this.#b ??= 0;
        return this.#b;
    }

    
    public get a(): number {
        this.#a ??= 1;
        return this.#a;
    }
}