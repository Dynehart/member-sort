# member-sort

The motivation for this rule is simply to make classes more predictable. While React functional components are what I often work with, my current project (a Phaser game) relies heavily on classes that can get rather large. I want every class in my projects to be organized in the exact same way and this rule exists to accomplish that.

This rule is highly opinionated but is based largely on `eslint-plugin-sort-class-members` and supports similar customization. The primary difference is the support for grouping private fields with matching accessers:

```ts
class MainClass extends Phaser.Scene {
    protected debugging = false;

    #zIndex?: number;
    public get zIndex(): number {
        this.#zIndex ??= 0;
        return this.#zIndex;
    }

    #bounds?: [number, number];
    private get bounds(): [number, number] {
        this.#bounds ??= [0, 0];
        return this.#bounds;
    }
}
```

And better handling of comments. Until a need for additional features arise, I will be trying to fix the somewhat clunky spacing