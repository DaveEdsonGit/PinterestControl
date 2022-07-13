// Defines the data for one tile that comes from the Server.
// The heightInPixels would likely get changed to something a bit
// more abstract, but for this quick exercise, I left it as pixels
export type TileData = 
{
    heightInPixels: number,
    text: string,
}

const MIN_TILE_HEIGHT_UNITS: number = 3;
const MAX_TILE_HEIGHT_UNITS: number = 15;
const PIXELS_PER_UNIT: number = 20;
const NUM_FAKE_TILES_TO_MAKE: number = 1000;
const FAKE_FETCH_DELAY_MS = 500;

// The source of Data on the Server
export default class TilesModel
{
    // I wrote a real backend in ASP.NET Core. For a quicker Dev Inner loop,
    // the fake one mimics the backend, right down to latency. This allows for
    // working on this app without needing to connect to anything.
    public static fake: boolean = true;
    private static fakeTiles: TileData[] | undefined;

    public static ToggleFake()
    {
        TilesModel.fake = !TilesModel.fake;
    }

    // Fetches some tile data from the "server"
    public static Fetch(startIndex: number, numberOfTiles: number) : Promise<TileData[]>
    {
        console.log(TilesModel.fake ? "Fetching fake data" : "Fetching data from server");
        if (TilesModel.fake)
        {
            TilesModel.createFakeData();
        }

        return TilesModel.fake
            ? TilesModel.fetchFakeTilesDataImpl(startIndex, numberOfTiles)
            : TilesModel.fetchTilesDataImpl(startIndex, numberOfTiles);
    }

    // In the event we use fake data, this will create it.
    private static createFakeData()
    {
        if (TilesModel.fakeTiles === undefined)
        {
            TilesModel.fakeTiles = [];
            for (let i = 0; i < NUM_FAKE_TILES_TO_MAKE; i++)
            {
                let units = Math.floor(Math.random() * (MAX_TILE_HEIGHT_UNITS - MIN_TILE_HEIGHT_UNITS));
                let height = PIXELS_PER_UNIT * (MIN_TILE_HEIGHT_UNITS + units);
                TilesModel.fakeTiles.push(
                    {
                        heightInPixels: height,
                        text: `Local Tile ${i}`
                    });
            }
        }        
    }

    // Fetches from the local fake array, with a fake delay.
    // Note: Not implementing the failure parts of the promise yet, because
    //       I ran out of time. But this obviously needs to be done if this
    //       was production code. Would likely use an exponential backoff on
    //       retries
    private static fetchFakeTilesDataImpl(startIndex: number, numberOfTiles: number) : Promise<TileData[]>
    {
        // TODO: Add fake failures, and failure retries, with exponential backoff?        
        let promise = new Promise<TileData[]>(function(resolved)
        {
            let result: TileData[] = [];
            if (TilesModel.fakeTiles)
            {
                // Make sure the input values are ok
                if (startIndex < 0)
                {
                    startIndex = 0;
                }
                if (startIndex + numberOfTiles > TilesModel.fakeTiles.length)
                {
                    numberOfTiles = TilesModel.fakeTiles.length - startIndex;
                }

                for (let i = 0; i < numberOfTiles; i++)
                {
                    const tileIndex = i + startIndex;
                    result.push(TilesModel.fakeTiles[tileIndex]);
                }
            }
            setTimeout(() => resolved(result), FAKE_FETCH_DELAY_MS);
        });

        return promise;        
    }

    private static fetchTilesDataImpl(startIndex: number, numberOfTiles: number) : Promise<TileData[]>
    {
        // TODO: Add failure retries, with exponential backoff?
        let promise = new Promise<TileData[]>(function(resolved)
        {
            fetch(`tiles?startIndex=${startIndex}&numberOfTiles=${numberOfTiles}`)
            .then((onFulfilled: Response) =>
            {
                onFulfilled.json()
                .then((data: TileData[]) => 
                {
                    resolved(data);
                })
            });
        });

        return promise;
    }
}