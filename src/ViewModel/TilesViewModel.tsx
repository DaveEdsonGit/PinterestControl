import TilesModel, { TileData } from "../Model/TilesModel"

// This is the data for a tile in the ViewModel. It contains
// the view-agnostic information in tileData, and then information
// that's specific to the view rendering it as the rest.
export type TileViewData =
{
    tileData: TileData,
    column: number,
    x: number,
    y: number,
    index: number
}

// When a View wants to get back a bunch of the ViewModel items
// for a Tile, this struct contains the view-specific information
// that the ViewModel uses to generate the values.
export type DisplayHints = 
{
    tileWidthPixels: number,
    horizontalSeparatorPixels: number,
    verticalSeparatorPixels: number,
    numberOfColumns: number
}

// Manages a list of View Model data for the tiles to be displayed.
// This class combines the view-agnostic data from the Model with the
// view-specific information (DisplayHints) to generate the TileViewData
// object(s), which are then rendered by the View.
export default class TilesViewModel
{
    // We want to cache data here so that the fetches are nice and quick if local
    private static tilesCache: TileViewData[] = [];
    // We want to serialize fetching, as two concurrent fetches could cause a race condition
    // or hitting the server multiple times for the same objects (and that would also then require
    // knowing about this and not inserting two copies of a TileViewData object into the cache.
    // There are other ways to serialize, such as a promise queue, but I was running out of time.
    private static fetching: boolean = false;

    // Via the Promise, returns an array of built TileViewData objects for the range, or null
    // if a fetch is currently in progress.
    public static TryFetch(startIndex: number, numberOfTiles: number, displayHints: DisplayHints) : Promise<TileViewData[] | null>
    {
        if (TilesViewModel.fetching)
        {
            let promise = new Promise<TileViewData[] | null>(function(resolved, failed)
            {
                setTimeout(() => resolved(null), 100);
            });
            return promise;
        }
        else
        {
            return TilesViewModel.fetchTilesViewDataImpl(startIndex, numberOfTiles, displayHints);
        }
    }

    // Does the work
    private static fetchTilesViewDataImpl(startIndex: number, numberOfTiles: number, displayHints: DisplayHints) : Promise<TileViewData[]>
    {
        TilesViewModel.fetching = true;        
        let promise = new Promise<TileViewData[]>(function(resolved)
        {
            // First make sure the cache has the requested values that are "before" the items in the cache
            // Second, make sure the cache has the requested values that are "after" the items in the cache
            // Then, we can grab the entries from the cache and return them.
            //
            // Currently, the cache is not constrained. In Production code, if the cache gets too large,
            // then we would want to discard some cached entries that are outside of the range requested.
            // Super smart caching may even attempt to track the direction the user is scrolling to
            // only remove entries from the side of the cache that's moving further away from the viewport.

            TilesViewModel.checkForMissingCacheEntriesBefore(startIndex, numberOfTiles, displayHints)
                .then(() => TilesViewModel.checkForMissingCacheEntriesAfter(startIndex, numberOfTiles, displayHints))
                .then(() => 
                {
                    const result = TilesViewModel.getCacheEntries(startIndex, numberOfTiles);
                    TilesViewModel.fetching = false;                    
                    resolved(result);
                });
        });

        return promise;
    }

    // This method, and checkForMissingCacheEntriesAfter are screaming for a refactor into one method.
    // Ran out of time.
    private static checkForMissingCacheEntriesBefore(startIndex: number, numberOfTiles: number, displayHints: DisplayHints) : Promise<void>
    {
        let promise = new Promise<void>(function(resolved)
        {
            if (TilesViewModel.tilesCache.length === 0)
            {
                resolved();
            }
            else
            {
                // Check to see if the cache has all the values, fill in the gaps before
                // or after
                const firstCacheItemIndex = TilesViewModel.tilesCache[0].index;
                if (startIndex < firstCacheItemIndex)
                {
                    // We need to fetch more entries to put at the start of the cache
                    const numberOfItemsToFetch = firstCacheItemIndex - startIndex;
                    TilesModel.Fetch(startIndex, numberOfItemsToFetch)
                    .then((data: TileData[]) => 
                    {
                        TilesViewModel.createTileViewData(true, data, displayHints, startIndex);
                        resolved();
                    });
                }
                else
                {
                    resolved();                
                }
            }
        });

        return promise;
    }

    private static checkForMissingCacheEntriesAfter(startIndex: number, numberOfTiles: number, displayHints: DisplayHints) : Promise<void>
    {
        let promise = new Promise<void>(function(resolved)
        {
            if (TilesViewModel.tilesCache.length === 0)
            {
                TilesModel.Fetch(startIndex, numberOfTiles)
                .then((data: TileData[]) => 
                {
                    TilesViewModel.createTileViewData(false, data, displayHints, startIndex);
                    resolved();
                });                
            }
            else
            {
                const lastCacheItemIndex = TilesViewModel.tilesCache[TilesViewModel.tilesCache.length-1].index;
                if (startIndex + numberOfTiles - 1 > lastCacheItemIndex)
                {
                    // We need to fetch more entries to put at the end of the cache
                    const numberOfItemsToFetch = startIndex + numberOfTiles - lastCacheItemIndex - 1;                
                    TilesModel.Fetch(lastCacheItemIndex + 1, numberOfItemsToFetch)
                    .then((data: TileData[]) => 
                    {
                        TilesViewModel.createTileViewData(false, data, displayHints, startIndex);
                        resolved();
                    });
                }
                else
                {
                    resolved();
                }
            }
        });

        return promise;
    }    

    private static createTileViewData(insertBefore: boolean, tileData: TileData[], displayHints: DisplayHints, startIndex: number)
    {
        if (insertBefore)
        {
            TilesViewModel.createTileViewDataBefore(tileData, displayHints);
        }
        else
        {
            TilesViewModel.createTileViewDataAfter(tileData, displayHints, startIndex);            
        }
    }

    // This method and createTileViewDataAfter are also screaming for a refactor into a single method.
    // Also ran out of time
    private static createTileViewDataBefore(tileData: TileData[], displayHints: DisplayHints)
    {
        // Get the column # of the first item as out starting point
        let firstItemCacheIndex: number = 0;
        let firstItem: TileViewData = TilesViewModel.tilesCache[firstItemCacheIndex];
        let firstItemIndex = firstItem.index;
        let columnNumber: number = firstItem.column;

        // And now let's make a little hashmap of the previous items of y position
        // for each column. Key is the viewModel item
        let columnItemIndexes = new Map<number, TileViewData>();
        do
        {
            const item: TileViewData = TilesViewModel.tilesCache[firstItemCacheIndex];
            columnItemIndexes.set(item.column, item);
            if (columnItemIndexes.size === displayHints.numberOfColumns)
            {
                // We have what we need, time to bail
                break;
            }
            firstItemCacheIndex++;
        }
        while (firstItemCacheIndex >= 0);

        for (let i = tileData.length-1; i >= 0; i--)
        {
            const tile = tileData[i];
            // Go to the prev column
            columnNumber = (columnNumber - 1 + displayHints.numberOfColumns) % displayHints.numberOfColumns;
            firstItemIndex--;
            // Get the item from the cache that's the last one
            const firstItemInColumn = columnItemIndexes.get(columnNumber);
            let y = 0;
            if (firstItemInColumn !== undefined)
            {
                y = TilesViewModel.getNextYPosition(true, firstItemInColumn, displayHints) - tile.heightInPixels;
            }
            const x = columnNumber * (displayHints.tileWidthPixels + displayHints.horizontalSeparatorPixels);
            let tileViewData: TileViewData = 
            {
                column: columnNumber,
                index: firstItemIndex,
                x: x,
                y: y,
                tileData: tile
            };
            TilesViewModel.tilesCache.splice(0, 0, tileViewData);
            columnItemIndexes.set(columnNumber, tileViewData);            
        };
    }

    private static createTileViewDataAfter(tileData: TileData[], displayHints: DisplayHints, startIndex: number)
    {
        // Get the column # of the last item as out starting point
        let lastItemCacheIndex: number = TilesViewModel.tilesCache.length-1;
        let lastItem: TileViewData | null = lastItemCacheIndex !== -1
            ? TilesViewModel.tilesCache[lastItemCacheIndex]
            : null;
        let lastItemIndex = lastItem != null
            ? lastItem.index
            : startIndex-1;
        let columnNumber: number = lastItem != null
            ? lastItem.column
            : -1;

        // And now let's make a little hashmap of the previous items of y position
        // for each column. Key is the viewModel item
        let columnItemIndexes = new Map<number, TileViewData>();
        while (lastItemCacheIndex >= 0)
        {
            const item: TileViewData = TilesViewModel.tilesCache[lastItemCacheIndex];
            if (!columnItemIndexes.has(item.column))
            {
                columnItemIndexes.set(item.column, item);
            }
            if (columnItemIndexes.size === displayHints.numberOfColumns)
            {
                // We have what we need, time to bail
                break;
            }
            lastItemCacheIndex--;
        }
        
        tileData.forEach((tile: TileData) =>
        {
            let y = Number.MAX_SAFE_INTEGER;            
            if (columnItemIndexes.size === displayHints.numberOfColumns)
            {
                // Once all columns are filled, find the column that's "shortest"
                columnItemIndexes.forEach((item, colNumber) => 
                {
                    const columnY = TilesViewModel.getNextYPosition(false, item, displayHints);
                    if (columnY < y)
                    {
                        y = columnY;
                        columnNumber = item.column;
                    }
                });
            }
            else
            {
                columnNumber++;
                y = 0;                
            }

            lastItemIndex++;
            const x = columnNumber * (displayHints.tileWidthPixels + displayHints.horizontalSeparatorPixels);
            let tileViewData: TileViewData = 
            {
                column: columnNumber,
                index: lastItemIndex,
                x: x,
                y: y,
                tileData: tile
            };
            TilesViewModel.tilesCache.push(tileViewData);
            columnItemIndexes.set(columnNumber, tileViewData);
        });
    }    

    private static getNextYPosition(insertBefore: boolean, tile : TileViewData, displayHints: DisplayHints) : number
    {
        return insertBefore
            ? tile.y - displayHints.verticalSeparatorPixels
            : tile.y + tile.tileData.heightInPixels + displayHints.verticalSeparatorPixels;
    }

    private static getCacheEntries(startIndex: number, numberOfTiles: number) : TileViewData[]
    {
        let result: TileViewData[] = [];

        // Check to see if the cache has all the values
        if (TilesViewModel.tilesCache.length >= numberOfTiles)
        {
            // Enough possible entries
            const firstCacheItemIndex = TilesViewModel.tilesCache[0].index;
            if (startIndex >= firstCacheItemIndex)
            {
                // Beginning of requested range is in cache
                if (startIndex - firstCacheItemIndex + numberOfTiles <= TilesViewModel.tilesCache.length)
                {
                    // Ending of requested range is in cache! We can get it all!
                    const firstIndexOffset = startIndex - TilesViewModel.tilesCache[0].index;
                    for (let i = 0; i < numberOfTiles; i++)
                    {
                        result.push(TilesViewModel.tilesCache[i + firstIndexOffset]);
                    }
                }
            }
        } 

        return result;
    }
}