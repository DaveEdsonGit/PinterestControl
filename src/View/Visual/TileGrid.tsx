import './tilegrid.css';

import { Component, createRef } from "react";
import TilesViewModel, { DisplayHints, TileViewData } from "../../ViewModel/TilesViewModel";
import Tile from "./Tile";
import TilesModel from '../../Model/TilesModel';

// The state maintained for the tiles
type TileGridState =
{
    tiles: TileViewData[],
}

// How much of the visible screen should be pre-fetched above and below the visible
// amount. For example, if items 80-99 are visible, and the percentage is 100%, then
// we have 20 items visible, so we want to have 20 items before and 20 items after
// buffered.
const BUFFERED_PERCENTAGE: number = 1.00; // 1.00 = 100%
// At the initial load, this is how many tiles to fetch to get started.
// The initialLoad method will repeatedly grab chunks until the buffering requires
// specified by the BUFFERED_PERCENTAGE constant are met.
const INITIAL_LOAD_CHUNKSIZE = 10;
// When retrying fetches, start by waiting this amount.
const INITIAL_RETRY_DELAY_MS = 100;

// Control that contains the Tiles
export default class TileGrid extends Component<{}, TileGridState>
{
    state: TileGridState =
    {
        tiles: [],
    };

    private containerRef = createRef<HTMLInputElement>();
    private initialNumberToFetch = INITIAL_LOAD_CHUNKSIZE;
    private firstVisibleTileIndex: number | undefined;
    private lastVisibleTileIndex: number | undefined;

    constructor(props: {})
    {
        super(props);
        this.fetch = this.fetch.bind(this);
        this.initialLoad = this.initialLoad.bind(this);        
        this.onScroll = this.onScroll.bind(this);
        this.getFirstVisibleTileIndex = this.getFirstVisibleTileIndex.bind(this);
        this.getLastVisibleTileIndex = this.getLastVisibleTileIndex.bind(this);
    }

    componentDidMount()
    {
        // Turn to fake data for fast inner dev loop. If you want to try this with the
        // real server data, you will need to be running it and then remove the call
        // to ToggleFake
        TilesModel.ToggleFake();
        this.initialLoad();
    }

    // Contains information that's specific to the View.
    // This information is used by the ViewModel to generate the TileViewData
    // objects that are part of the state.
    private getDisplayHints() : DisplayHints
    {
        // For now, I hardcoded this. In reality, settings or even styles
        // may cover all but the number of columns.
        // Right now the columns are hardcoded to 3. Production code would
        // change that value when the window is resized horizontally.
        // And, if the number of columns changes, then the view data would
        // all need to be re-fetched, and we would also need to think about
        // how to ensure that the topmost item in the window is still the topmost
        // item after the size.
        return {
            horizontalSeparatorPixels: 15,
            verticalSeparatorPixels: 15,
            numberOfColumns: 3,
            tileWidthPixels: 243
        };        
    }

    // Makes the call to fetch the tile's view model data, once
    // received, updates the state which causes a redraw.
    private fetch(startIndex: number, numberOfTiles: number, retryDelayMs: number = INITIAL_RETRY_DELAY_MS) : void
    {
        const retryCallback = this.fetch;
        TilesViewModel.TryFetch(startIndex, numberOfTiles, this.getDisplayHints())
        .then((data: TileViewData[] | null) => 
        {
            //if (data == null || data.length === 0)            
            if (data == null)
            {
                // Exponential backoff for retry.
                // data is null if there is already a query going on
                setTimeout(() => retryCallback(startIndex, numberOfTiles, retryDelayMs*2), retryDelayMs);
            }
            else
            {
                this.setState({ tiles: data });
            }
        });
    }

    // Starts initial fetching until we have enough displayed and buffered
    private initialLoad(retryDelayMs: number = INITIAL_RETRY_DELAY_MS) : void
    {
        const retryCallback = this.initialLoad;

        if (!this.containerRef.current)
        {
            // This should not happen, but in case it does, we will try again in a short moment
            setTimeout(() => retryCallback(retryDelayMs*2), retryDelayMs);            
            return;
        }

        let lastTileY = 0;

        const controlHeight = this.containerRef.current!.clientHeight;            
        const lastYToFetch = controlHeight + controlHeight * BUFFERED_PERCENTAGE;

        TilesViewModel.TryFetch(0, this.initialNumberToFetch, this.getDisplayHints())
        .then((data: TileViewData[] | null) => 
        {
            if (data == null)
            {
                // Exponential Backoff
                setTimeout(() => retryCallback(retryDelayMs*2), retryDelayMs);            
            }
            else
            {
                this.setState({ tiles: data });
                lastTileY = data[data.length-1].y;
                if (lastTileY < lastYToFetch)
                {
                    this.initialNumberToFetch += INITIAL_LOAD_CHUNKSIZE;
                    // Not enough. Re-run the fetch (the values grabbed are cached, so
                    // not a huge perf hit)
                    // No exponential backoff here, this was success, we just need to add more
                    retryCallback();
                }                
            }
        });
    }

    // Known BUG: If you scroll up too fast, we are not grabbing the tiles right, and you
    //            get blank screen.
    private onScroll() : void
    {
        if (!this.containerRef.current)
        {
            return;
        }

        // Step 1: Figure out which tiles are the bounds for what's
        //         visible
        const newFirstVisibleTileIndex = this.getFirstVisibleTileIndex();
        const newLastVisibleTileIndex = this.getLastVisibleTileIndex();
        if (newFirstVisibleTileIndex === this.firstVisibleTileIndex && newLastVisibleTileIndex === this.lastVisibleTileIndex)
        {
            // This scroll event was not enough to move anything. No need to do any
            // further work.
            return;
        }

        if (newFirstVisibleTileIndex === -1 || newLastVisibleTileIndex === -1)
        {
            // Nothing to see here, move along
            return;
        }

        // Update instance info to match new scroll event
        this.firstVisibleTileIndex = newFirstVisibleTileIndex;
        this.lastVisibleTileIndex = newLastVisibleTileIndex;

        // Step 2: Count how many tiles are visible on the screen        
        const visibleTiles = newLastVisibleTileIndex - newFirstVisibleTileIndex;
        const bufferedTiles = Math.floor(visibleTiles * BUFFERED_PERCENTAGE);

        // Step 3: Figure out the range on either side to ensure is cached
        const firstLoadedTileIndex = Math.max(0, newFirstVisibleTileIndex - bufferedTiles);
        const lastLoadedTileIndex = newLastVisibleTileIndex + bufferedTiles;
        const totalTilesToFetch = lastLoadedTileIndex - firstLoadedTileIndex;

        // Step 4: If there are tiles to fetch-- grab them!
        if (totalTilesToFetch !== 0)
        {
            this.fetch(firstLoadedTileIndex, totalTilesToFetch);
        }
    }

    private getFirstVisibleTileIndex() : number
    {
        let result: number = -1;
        if (this.containerRef.current)
        {
            const scrollTop = this.containerRef.current!.scrollTop;
            this.state.tiles.forEach((tile: TileViewData) => {
                if (tile.y >= scrollTop && result === -1)
                {
                    result = tile.index;
                }
            });
        }

        return result;
    }

    private getLastVisibleTileIndex() : number
    {
        let result: number = -1;
        if (this.containerRef.current)
        {
            const scrollTop = this.containerRef.current!.scrollTop;
            const controlHeight = this.containerRef.current!.clientHeight;            
            for (let i = this.state.tiles.length-1; i >= 0; i--)
            {
                let tile: TileViewData = this.state.tiles[i];
                if (tile.y < scrollTop + controlHeight)
                {
                    result = tile.index;
                    break;
                }
            };
        }

        return result;        
    }    

    private renderTiles() : JSX.Element | null
    {
        if (!this.state.tiles || this.state.tiles.length === 0)
        {
            return <div>Loading...</div>;
        }

        const displayHints = this.getDisplayHints();

        let maxY = 0;
        this.state.tiles.forEach((tile: TileViewData) => {
            maxY = Math.max(maxY, tile.y + tile.tileData.heightInPixels);
        });

        const style = { height: `${maxY}px` };

        return (
            <div 
                className={'tilegrid'} 
                style={style} 
             >
                { this.state.tiles.map(tile => <Tile key={tile.index} displayHints={displayHints} viewData={tile} />) }
            </div>
        );        
    }

    render()
    {
        return (
            <div 
                className={'tilegridcontainer'} 
                ref={this.containerRef}
                onScroll={() => this.onScroll()}
            >
            { this.renderTiles() }
          </div>          
        );
    }
}