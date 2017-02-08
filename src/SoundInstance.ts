import Sound from './Sound';

let id = 0;

/**
 * A single play instance that handles the AudioBufferSourceNode.
 * @class SoundInstance
 * @memberof PIXI.sound
 * @param {SoundNodes} source Reference to the SoundNodes.
 */
export default class SoundInstance extends PIXI.utils.EventEmitter
{
    /**
     * Recycle instance, because they will be created many times.
     * @type {Array}
     * @name PIXI.sound.SoundInstance._pool
     * @static
     * @private
     */
    static _pool:Array<SoundInstance> = [];

    /**
     * The current unique ID for this instance.
     * @name PIXI.sound.SoundInstance#id
     * @readOnly
     */
    public id:number;

    /**
     * The source Sound.
     * @type {SoundNodes}
     * @name PIXI.sound.SoundInstance#_parent
     * @private
     */
    private _parent:Sound;

    /**
     * The starting time.
     * @type {int}
     * @name PIXI.sound.SoundInstance#_startTime
     * @private
     */
    private _startTime:number;

    /**
     * true if paused.
     * @type {Boolean}
     * @name PIXI.sound.SoundInstance#_paused
     * @private
     */
    private _paused:boolean;

    /**
     * The current position in seconds.
     * @type {int}
     * @name PIXI.sound.SoundInstance#_position
     * @private
     */
    private _position:number;

    /**
     * Progress float from 0 to 1.
     * @type {Number}
     * @name PIXI.sound.SoundInstance#_progress
     * @private
     */
    private _progress:number;

    /**
     * Total length of audio in seconds.
     * @type {Number}
     * @name PIXI.sound.SoundInstance#_duration
     * @private
     */
    private _duration:number;

    /**
     * Audio buffer source clone from Sound object.
     * @type {AudioBufferSourceNode}
     * @name PIXI.sound.SoundInstance#_source
     * @private
     */
    private _source:AudioBufferSourceNode;

    /**
     * Recycle instance, because they will be created many times.
     * @method PIXI.sound.SoundInstance.create
     * @static
     * @private
     * @param {PIXI.sound.Sound} parent Parent sound object
     */
    public static create(parent:Sound):SoundInstance
    {
        if (SoundInstance._pool.length > 0)
        {
            let sound = SoundInstance._pool.pop();
            sound._init(parent);
            return sound;
        }
        else
        {
            return new SoundInstance(parent);
        }
    }

    constructor(parent:Sound)
    {
        super();

        this.id = id++;
        this._parent = null;
        this._startTime = 0;
        this._paused = false;
        this._position = 0;
        this._duration = 0;
        this._progress = 0;

        // Initialize
        this._init(parent);
    }

    /**
     * Stops the instance, don't use after this.
     * @method PIXI.sound.SoundInstance#stop
     */
    public stop():void
    {
        if (this._source)
        {
            this._internalStop();

            /**
             * The sound is stopped. Don't use after this is called.
             * @event PIXI.sound.SoundInstance#stop
             */
            this.emit('stop');
        }
    }

    /**
     * Plays the sound.
     * @method PIXI.sound.SoundInstance#play
     * @param {Number} [offset=0] Number of seconds to offset playing.
     */
    public play(offset:number = 0):void
    {
        this._progress = 0;
        this._paused = false;
        this._position = offset;
        this._source = this._parent.nodes.cloneBufferSource();
        this._duration = this._source.buffer.duration;
        this._startTime = this._now;
        this._source.onended = this._onComplete.bind(this);
        this._source.start(0, offset);

        /**
         * The sound is started.
         * @event PIXI.sound.SoundInstance#start
         */
        this.emit('start');

        /**
         * The sound progress is updated.
         * @event PIXI.sound.SoundInstance#progress
         * @param {Number} progress Amount progressed from 0 to 1
         */
        this.emit('progress', 0);

        // Start handling internal ticks
        this._onUpdate();
    }

    /**
     * Start the update progress.
     * @method PIXI.sound.SoundInstance#_onUpdate
     * @private
     * @param {Boolean} [enabled = true] `true` to start listening
     */
    private _onUpdate(enabled:boolean = true): void
    {
        this._parent.nodes.scriptNode.onaudioprocess = !enabled ? null : () => {
            this._update();
        };
    }

    /**
     * The current playback progress from 0 to 1.
     * @type {Number}
     * @name PIXI.sound.SoundInstance#progress
     */
    public get progress():number
    {
        return this._progress;
    }

    /**
     * Pauses the sound.
     * @type {Boolean}
     * @name PIXI.sound.SoundInstance#paused
     */
    public get paused():boolean
    {
        return this._paused;
    }

    public set paused(paused:boolean)
    {
        if (paused !== this._paused)
        {
            this._paused = paused;

            if (paused)
            {
                // pause the sounds
                this._internalStop();
                let speed:number = 1;
                if (this._source)
                {
                    speed = this._source.playbackRate.value;
                }
                this._position = (this._now - this._startTime) * speed;
                /**
                 * The sound is paused.
                 * @event PIXI.sound.SoundInstance#paused
                 */
                this.emit('paused');
            }
            else
            {
                /**
                 * The sound is unpaused.
                 * @event PIXI.sound.SoundInstance#resumed
                 */
                this.emit('resumed');
                // resume the playing with offset
                this.play(this._position);
            }

            /**
             * The sound is paused or unpaused.
             * @event PIXI.sound.SoundInstance#pause
             * @param {Boolean} paused If the instance was paused or not.
             */
            this.emit('pause', paused);
        }
    }
    
    /**
     * Don't use after this.
     * @method PIXI.sound.SoundInstance#destroy
     */
    public destroy():void
    {
        this.removeAllListeners();
        this._internalStop();
        if (this._source)
        {
            this._source.onended = null;
        }
        this._source = null;
        this._parent = null;
        this._startTime = 0;
        this._paused = false;
        this._position = 0;
        this._duration = 0;

        // Add it if it isn't already added
        if (SoundInstance._pool.indexOf(this) < 0)
        {
            SoundInstance._pool.push(this);
        }
    }

    /**
     * To string method for instance.
     * @method PIXI.sound.SoundInstance#toString
     * @return {String} The string representation of instance.
     * @private
     */
    public toString():string
    {
        return '[SoundInstance id=' + this.id + ']';
    }

    /**
     * Get the current time in seconds.
     * @method PIXI.sound.SoundInstance#_now
     * @private
     * @return {Number} Seconds since start of context
     */
    private get _now(): number
    {
        return this._parent.context.audioContext.currentTime;
    }

    /**
     * Internal update the progress.
     * @method PIXI.sound.SoundInstance#_update
     * @private
     */
    private _update(): void
    {
        if (this._duration)
        {
            const speed:number = this._source.playbackRate.value;
            const position = this._paused ? this._position : (this._now - this._startTime);
            this._progress = Math.max(0, Math.min(1, (position / this._duration) * speed));
            this.emit('progress', this._progress);
        }
    }

    /**
     * Initializes the instance.
     * @method PIXI.sound.SoundInstance#init
     * @private
     */
    private _init(parent:Sound):void
    {
        this._parent = parent;
    }

    /**
     * Stops the instance.
     * @method PIXI.sound.SoundInstance#_internalStop
     * @private
     */
    private _internalStop():void
    {
        if (this._source)
        {
            this._onUpdate(false);
            this._source.onended = null;
            this._source.stop();
            this._source = null;

        }
    }

    /**
     * Callback when completed.
     * @method PIXI.sound.SoundInstance#_onComplete
     * @private
     */
    private _onComplete():void
    {
        if (this._source)
        {
            this._onUpdate(false);
            this._source.onended = null;
        }
        this._source = null;
        this._progress = 1;
        this.emit('progress', 1);
        /**
         * The sound ends, don't use after this
         * @event PIXI.sound.SoundInstance#end
         */
        this.emit('end', this);
    }
}