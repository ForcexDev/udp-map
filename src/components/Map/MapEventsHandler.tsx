import { FC } from 'react';
import { useMapEvents } from 'react-leaflet';
import * as L from 'leaflet';

interface MapEventsHandlerProps {
    onClick: (e: L.LeafletMouseEvent) => void;
}

const MapEventsHandler: FC<MapEventsHandlerProps> = ({ onClick }) => {
    useMapEvents({
        click: (e) => {
            if (e.latlng) onClick(e);
        },
    });
    return null;
};

export default MapEventsHandler;
