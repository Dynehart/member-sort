import { FunctionParamError } from "../../common";
import { InputProvider } from "../helpers";
import { ConfigManager, Player, SceneInput } from "../plugin";
import { IBaseScene, Layers } from "../types";

import { Boot } from "./Boot";

const drawCircle = (cx: number, cy: number, r: number): number[][] => {
    const data: number[][] = [];
    for (let i = -r; i <= r; i += 1) {
        data[i + cx] ??= new Array(cy);
        const row = data[i + cx];
        if (!row) throw new Error();

        for (let j = -r; j <= r; j += 1) {
            // use `Math.round(Math.sqrt(i * i + j * j)) === r` for just the circumference
            if (Math.round(Math.sqrt(i * i + j * j)) <= r) {
                // 8x8 = up to 64
                row[j + cy] ??= Math.floor(Math.random() * 64);
            } else {
                row[j + cy] ??= undefined;
            }
        }
    }

    return data;
};

const drawRectangle = (x: number, y: number): number[][] => {
    const data: number[][] = [];
    for (let i = 0; i < x; i++) {
        data[i] ??= [];
        const row = data[i];
        if (!row) throw new Error();

        for (let j = 0; j < y; j++) {
            // 8x8 = up to 64
            row[j] ??= Math.floor(Math.random() * 64);
        }
    }

    return data;
};

const getTilemapData = (
    height: number,
    width: number,
): Phaser.Types.Tilemaps.TilemapConfig & Required<Pick<Phaser.Types.Tilemaps.TilemapConfig, "data">> => {
    const TILE_SCALE = 3;
    const TILE_DIMENSIONS = 32;
    // const TILE_ROWS = this.scale.height / (TILE_DIMENSIONS * TILE_SCALE);
    // const TILE_COLS = this.scale.width / (TILE_DIMENSIONS * TILE_SCALE);
    const TILE_ROWS = height / (TILE_DIMENSIONS * TILE_SCALE);
    const TILE_COLS = width / (TILE_DIMENSIONS * TILE_SCALE);

    const C = Math.max(TILE_ROWS, TILE_COLS);

    // const data = drawRectangle(TILE_ROWS, TILE_COLS);
    const data = drawCircle(C, C, C);

    return {
        data,

        height: TILE_COLS,
        tileHeight: TILE_DIMENSIONS,

        tileWidth: TILE_DIMENSIONS,
        width: TILE_ROWS,
    };
};

// let tilemapData: Phaser.Types.Tilemaps.TilemapConfig;

// abstract class Base extends Phaser.Scene {
//     protected abstract debugging: boolean;
// }

// export class BaseScene extends Base implements IBaseScene {
export class BaseScene extends Phaser.Scene implements IBaseScene {
    protected debugging = false;

    private _configPlugin: ConfigManager | null = null;
    private _inputPlugin: SceneInput | null = null;
    // this might need to move into mainscene
    private _playerPlugin: Player | null = null;
    private boundry = {
        radius: 3840 / 2,
        x: this.scale.width / 2,
        y: this.scale.height / 2,
    };


    private _bounds?: Phaser.GameObjects.Graphics;
    public get bounds(): Phaser.GameObjects.Graphics {
        if (!this._bounds) {
            this._bounds ??= this.add.graphics({
                lineStyle: { alpha: 0.5, color: 0xff0000, width: 10 },
            });
            this._bounds.strokeCircle(this.scale.width / 2, this.scale.height / 2, 3840 / 2);
        }

        return this._bounds;
    }

    //test
    private _inputProvider?: InputProvider;
    /** global input provider */
    protected get inputProvider(): InputProvider {
        this._inputProvider ??= new InputProvider(this, 42);
        return this._inputProvider;
    }

    

    protected get config(): ConfigManager {
        if (!this._configPlugin) {
            const input = this.game.plugins.get(ConfigManager.key);
            if (input instanceof ConfigManager) {
                this._configPlugin = input;
            } else {
                throw new Error("misconfigured plugin");
            }
        }

        return this._configPlugin;
    }
    protected get inputv2(): SceneInput {
        if (!this._inputPlugin) {
            this.load.scenePlugin(SceneInput.key, SceneInput, SceneInput.mapping);

            throw new Error("misconfigured scene plugin");
        }

        return this._inputPlugin;
    }

    private _layers?: Layers;
    public get layers(): Layers {
        if (!this._layers) {
            const mapHeight = this.scale.height / 2;
            const mapWidth = this.scale.width / 2;
            const mapOffset = Math.max(mapHeight, mapWidth) / 2;

            const data = getTilemapData(mapHeight, mapWidth);
            data.data.forEach((row, i) => {
                row.forEach((col, j) => {});
            });

            const map = this.make.tilemap(data);
            const tiles = map.addTilesetImage("tileset-grass");
            if (tiles === null) {
                throw new Error("tileset problems");
            }

            this._layers = {
                // eslint-disable-next-line sort/object-properties
                map: map.createLayer(0, tiles, 0, -mapOffset),
                resource: this.add.layer().setDepth(1),
                game: this.add.layer().setDepth(5),
                ui: this.add.layer(),
                menu: this.add.layer().setVisible(false).setDepth(10),
            };
            this.bounds;

            this._layers.map?.setScale(3);
        }
        return this._layers;
    }
// testmctest2

    // init() → preload() → create() → update() → (repeat update)

    //        ↓
    // shutdown() → destroy()
    protected get playerplugin(): Player {
        if (!this._playerPlugin) {
            const player = this.game.plugins.get(Player.key);
            if (player instanceof Player) {
                this._playerPlugin = player;
            } else {
                throw new Error("misconfigured plugin");
            }
        }

        return this._playerPlugin;
    }
    public init(): void {
        this.physics.world.drawDebug = false;

        this.events.on("update", (time: unknown, delta: unknown) => {
            if (typeof time !== "number" || typeof delta !== "number") throw new FunctionParamError();
            this.inputProvider.update(time, delta);
        });
        // this.events.once(
        //     Phaser.Scenes.Events.SHUTDOWN,
        //     () => {
        //         this.shutdown();
        //     },
        //     this,
        // );
    }
    
    public shutdown(): void {
        this._inputProvider = undefined;
        this._layers = undefined;
    }


    protected clampToCircle(gameObject: Phaser.Physics.Arcade.Body): void {
        // Calculate the distance of the object from the center of the circle
        const distance = Phaser.Math.Distance.Between(gameObject.x, gameObject.y, this.boundry.x, this.boundry.y);

        // If the object is outside the circular boundary
        if (distance > this.boundry.radius) {
            // Find the angle from the center to the game object
            const angle = Phaser.Math.Angle.Between(this.boundry.x, this.boundry.y, gameObject.x, gameObject.y);

            // Set the object's position to the edge of the circle
            gameObject.x = this.boundry.x + Math.cos(angle) * this.boundry.radius;
            gameObject.y = this.boundry.y + Math.sin(angle) * this.boundry.radius;

            // Reverse the object's velocity to simulate a bounce
            const vector = new Phaser.Math.Vector2(gameObject.body.velocity.x, gameObject.body.velocity.y);
            const normal = new Phaser.Math.Vector2(Math.cos(angle), Math.sin(angle));
            vector.reflect(normal);
            gameObject.setVelocity(vector.x, vector.y);
        }
    }
    
}
