import { Component } from "react";
import TilesModel from "../../Model/TilesModel";
import TilesViewModel, { DisplayHints, TileViewData } from "../../ViewModel/TilesViewModel";

// Defines the state for this view
type PlainState =
{
    tiles: TileViewData[];
    fetching: boolean,
    dataSourceButtonText: string
}

// Shows the result of fetches, as the TileViewData values
export default class Plain extends Component<{}, PlainState>
{
    state: PlainState =
    {
        tiles: [],
        fetching: false,
        dataSourceButtonText: ''
    };

    constructor(props: {})
    {
        super(props);
        this.fetch = this.fetch.bind(this);
        this.toggleFake = this.toggleFake.bind(this);
        this.state.dataSourceButtonText = Plain.getDataSourceText();
    }

    private static getDataSourceText() : string
    {
        return TilesModel.fake ? "Use Server Data" : "Use Fake Data";
    }

    private static getDisplayHints() : DisplayHints
    {
        return {
            horizontalSeparatorPixels: 5,
            verticalSeparatorPixels: 5,
            numberOfColumns: 3,
            tileWidthPixels: 243
        };        
    }

    private fetch(startIndex: number, numberOfTiles: number) : void
    {
        this.setState({ tiles: [], fetching: true });
        const retryCallback = this.fetch;
        TilesViewModel.TryFetch(startIndex, numberOfTiles, Plain.getDisplayHints())
        .then((data: TileViewData[] | null) => 
        {
            // Kinda hacky. Perhaps if there is a query going on it would make
            // sense to fail versus resolve with null. But this also works.
            // But if we used the failure method versus resolved, then we would
            // need to have that method know if a retry should happen or not.
            // So six on one, half a dozen the other
            if (data == null)
            {
                console.log("Waiting for previous query to finish...");
                retryCallback(startIndex, numberOfTiles);
            }
            else
            {
                console.log("PlainData got test data:");
                console.log(data);  
                this.setState({ tiles: data, fetching: false });
            }
        });
    }

    private toggleFake() : void
    {
        TilesModel.ToggleFake();
        this.setState({ dataSourceButtonText: Plain.getDataSourceText() });
    }    

    private renderList() : JSX.Element
    {
        let displayHints = Plain.getDisplayHints();
        return (
            <>
            {
                this.state.tiles.map(tile => 
                (
                <div>
                    {`${tile.tileData.text}: (${tile.x},${tile.y})-(${tile.x + displayHints.tileWidthPixels },${tile.y + tile.tileData.heightInPixels})`}
                </div>
                ))
            }
            </>
        );        
    }

    render()
    {
        return (
            <>
            <button onClick={() => this.fetch(0, 5)}>Fetch Data 0-4</button>
            <button onClick={() => this.fetch(2, 5)}>Fetch Data 2-6</button>
            <button onClick={() => this.fetch(6, 5)}>Fetch Data 6-10</button>
            <button onClick={() => this.fetch(8, 5)}>Fetch Data 8-12</button>
            <button onClick={() => this.fetch(10, 5)}>Fetch Data 10-14</button>
            <br />
            <button onClick={() => this.toggleFake()}>{this.state.dataSourceButtonText}</button>
            <br />
            {
                this.state.fetching
                    ? "Fetching..."
                    : this.renderList()
            }
          </>          
        );
    }
}