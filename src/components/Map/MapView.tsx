import { FC, MutableRefObject } from 'react';
import { MapContainer, TileLayer, LayersControl, Marker } from 'react-leaflet';
import { Post, User, Faculty } from '../../config/types';
import MapMarker, { FacultyLabel } from './MapMarker';
import MapHUD from './MapHUD';
import MapController from './MapController';
import { createUserLocationIcon } from '../../utils/mapUtils';
import { Lang } from '../../i18n';
import * as L from 'leaflet';

interface MapViewProps {
    user: User;
    lang: Lang;
    filteredPosts: Post[];
    userVotes: Record<string, 'up' | 'down'>;
    currentCampus: { id: string; name: string; coords: [number, number] };
    campusFaculties: Faculty[];
    activeFacultyId: string;
    isPlacingMode: boolean;
    userLocation: [number, number] | null;
    mapRef: MutableRefObject<L.Map | null>;
    onVote: (postId: string, type: 'up' | 'down') => void;
    onTogglePin: (postId: string) => void;
    onDelete: (postId: string) => void;
    onSidebarOpen: () => void;
    onFacultySelect: (fac: Faculty) => void;
    onLocateUser: () => void;
    onStartPlacing: () => void;
    onCancelPlacement: () => void;
    onConfirmPlacement: () => void;
    onExploreFaculty: (faculty: Faculty) => void;
}

const MapView: FC<MapViewProps> = ({
    user,
    lang,
    filteredPosts,
    userVotes,
    currentCampus,
    campusFaculties,
    activeFacultyId,
    isPlacingMode,
    userLocation,
    mapRef,
    onVote,
    onTogglePin,
    onDelete,
    onSidebarOpen,
    onFacultySelect,
    onLocateUser,
    onStartPlacing,
    onCancelPlacement,
    onConfirmPlacement,
    onExploreFaculty
}) => {
    return (
        <div className="w-full h-full relative overflow-hidden">
            <MapContainer
                center={currentCampus.coords}
                zoom={18}
                maxZoom={22}
                className="absolute inset-0 z-0"
                zoomControl={false}
                attributionControl={true}
                ref={mapRef as any}
            >
                <LayersControl position="bottomleft">
                    <LayersControl.BaseLayer name="📍 Estándar" checked>
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; OpenStreetMap'
                            maxZoom={22}
                            maxNativeZoom={19}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="🚌 Transporte">
                        <TileLayer
                            url="https://tileserver.memomaps.de/tilegen/{z}/{x}/{y}.png"
                            attribution='&copy; OPNVkarte'
                            maxZoom={22}
                            maxNativeZoom={18}
                        />
                    </LayersControl.BaseLayer>
                    <LayersControl.BaseLayer name="✨ Limpio">
                        <TileLayer
                            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
                            attribution='&copy; CARTO'
                            maxZoom={22}
                            maxNativeZoom={20}
                        />
                    </LayersControl.BaseLayer>
                </LayersControl>

                <MapController campusCoords={currentCampus.coords} />

                {/* Faculty Labels on Map */}
                {campusFaculties.filter(f => f.id !== 'global').map(f => (
                    <FacultyLabel key={`label-${f.id}`} faculty={f} onExplore={onExploreFaculty} />
                ))}

                {/* User Location Pulsing Dot */}
                {userLocation && (
                    <Marker
                        position={userLocation}
                        icon={createUserLocationIcon()}
                        interactive={false}
                    />
                )}

                {/* Post Markers */}
                {!isPlacingMode && filteredPosts.map(post => (
                    <MapMarker
                        key={post.id}
                        post={post}
                        user={user}
                        lang={lang}
                        userVote={userVotes[post.id]}
                        onVote={onVote}
                        onTogglePin={onTogglePin}
                        onDelete={onDelete}
                    />
                ))}
            </MapContainer>

            <MapHUD
                user={user}
                lang={lang}
                currentCampus={currentCampus}
                campusFaculties={campusFaculties}
                activeFacultyId={activeFacultyId}
                isPlacingMode={isPlacingMode}
                onSidebarOpen={onSidebarOpen}
                onFacultySelect={onFacultySelect}
                onLocateUser={onLocateUser}
                onStartPlacing={onStartPlacing}
                onCancelPlacement={onCancelPlacement}
                onConfirmPlacement={onConfirmPlacement}
            />
        </div>
    );
};

export default MapView;
