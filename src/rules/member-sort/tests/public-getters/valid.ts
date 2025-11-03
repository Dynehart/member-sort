export class BaseScene {
    #buildings?: Phaser.Physics.Arcade.Group;
    public get buildings(): Phaser.Physics.Arcade.Group {
        if (!this.#buildings) {
            this.#buildings = this.physics.add.group();
            this.#buildings.runChildUpdate = true;
        }
        return this.#buildings;
    }

    public _debugGraphics?: Phaser.GameObjects.Graphics;
    public get debugGraphics(): Phaser.GameObjects.Graphics | null {
        if (!this.debugging) {
            this._debugGraphics?.clear();
            return null;
        }

        this._debugGraphics ??= this.add.graphics();

        return this._debugGraphics;
    }

    #drops?: Phaser.Physics.Arcade.Group;
    public get drops(): Phaser.Physics.Arcade.Group {
        if (!this.#drops) {
            this.#drops = this.physics.add.group();
            this.#drops.runChildUpdate = true;
        }
        return this.#drops;
    }
}
