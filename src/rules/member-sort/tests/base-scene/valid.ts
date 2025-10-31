export class BaseScene {
    // not a private field
    public _publicField?: number;

    protected debugging = false;

    // case mismatch
    private _caseMismatch: number | null = null;

    // "getter" is a method
    private _config?: number;

    private _configPlugin: number | null = null;

    // private field not used by getter/setter
    private _noGetter: number | null = null;

    // private and matching
    private _layers?: number;
    public get layers(): number {
        return (this._layers ??= 1);
    }

    // private and matching
    #players?: number;
    public get players(): number {
        return (this.#players ??= 1);
    }

    protected get casemismatch(): number {
        this._caseMismatch ??= 2;
        return this._caseMismatch;
    }

    protected get inputv2(): number {
        this._noGetter ??= 4;
        return this._noGetter;
    }

    /** global input provider */
    protected get publicField(): number {
        this._publicField ??= 5;
        return this._publicField;
    }

    // protected before private
    #xp?: number;
    protected get xp(): number {
        this.#xp = 0;
        return this.#xp;
    }

    constructor() {
        this.debugging = true;
    }

    public init(): void {
        /* empty */
    }

    public shutdown(): void {
        this._publicField = undefined;
        this._layers = undefined;
    }

    protected config(): number {
        this._configPlugin ??= 3;
        this._config ??= 3;

        return this._configPlugin;
    }
}
