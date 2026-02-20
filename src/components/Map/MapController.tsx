import { useEffect, FC } from 'react';
import { useMap } from 'react-leaflet';

interface MapControllerProps {
    campusCoords: [number, number];
}

const MapController: FC<MapControllerProps> = ({ campusCoords }) => {
    const map = useMap();

    useEffect(() => {
        if (campusCoords && campusCoords[0] !== 0) {
            map.flyTo(campusCoords, 18, { animate: true, duration: 1.5 });
        }
    }, [campusCoords, map]);

    useEffect(() => {
        const timer = setTimeout(() => map.invalidateSize(), 500);
        return () => clearTimeout(timer);
    }, [map]);

    return null;
};

export default MapController;
