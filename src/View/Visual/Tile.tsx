import './tile.css';
import { Component } from "react";
import { DisplayHints, TileViewData } from "../../ViewModel/TilesViewModel";

type TileProperties =
{
    viewData: TileViewData,
    displayHints: DisplayHints
};

export default class Tile extends Component<TileProperties, {}>
{
    render()
    {
        const x = this.props.viewData.x;
        const y = this.props.viewData.y;
        const dx = this.props.displayHints.tileWidthPixels;
        const dy = this.props.viewData.tileData.heightInPixels;
        const id = this.props.viewData.index;

        // The tile is positioned absolutely inside the TileGrid, which is a relative positioning.
        // Utilizing the transform here, we can position the tile to the right location.
        const style = { transform: `translateX(${x}px) translateY(${y}px)`, width: `${dx}px`, height: `${dy}px` };

        return (
            <div key={id} className={`tile`} style={style} >
                {this.props.viewData.tileData.text}
            </div>
        );
    }
}
