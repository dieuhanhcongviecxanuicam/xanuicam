import React, { useState, useEffect } from 'react';
import ModalWrapper from './ModalWrapper';
const MapPickerModal = ({ isOpen, onClose, initialPosition = null, onSelect }) => {
  const [pos, setPos] = useState(initialPosition || null);
  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [LeafletComponents, setLeafletComponents] = useState(null);

  useEffect(() => { if (initialPosition) setPos(initialPosition); }, [initialPosition]);

  useEffect(() => {
    // Try dynamic import of react-leaflet only in browser env; tests that run in Node will skip.
    let mounted = true;
    (async () => {
      try {
        if (typeof window === 'undefined') return;
        const mod = await import('react-leaflet');
        const { MapContainer, TileLayer, Marker, useMapEvents } = mod;
        if (!mounted) return;
        setLeafletComponents({ MapContainer, TileLayer, Marker, useMapEvents });
        setLeafletLoaded(true);
      } catch (e) {
        // fail gracefully — tests and lightweight environments will use manual inputs
        if (mounted) setLeafletLoaded(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const doUseCurrent = () => {
    if (!navigator.geolocation) return alert('Trình duyệt không hỗ trợ vị trí.');
    navigator.geolocation.getCurrentPosition(p => setPos([p.coords.latitude, p.coords.longitude]), () => alert('Không thể lấy vị trí hiện tại.'));
  };

  const onManualSelect = () => {
    if (!pos) return alert('Vui lòng nhập hoặc chọn vị trí.');
    onSelect && onSelect(pos);
    onClose();
  };

  const LeafletView = () => {
    if (!LeafletComponents) return null;
    const { MapContainer, TileLayer, Marker, useMapEvents } = LeafletComponents;
    const ClickHandler = ({ setPosLocal }) => {
      useMapEvents({ click: (e) => { setPosLocal([e.latlng.lat, e.latlng.lng]); } });
      return null;
    };
    return (
      <MapContainer center={pos || [21.0278, 105.8342]} zoom={13} style={{ height: '100%', width: '100%' }}>
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <ClickHandler setPosLocal={setPos} />
        {pos && <Marker position={pos} />}
      </MapContainer>
    );
  };

  const [googleLoaded, setGoogleLoaded] = useState(false);
  const [GoogleComponents, setGoogleComponents] = useState(null);

  useEffect(() => {
    if ((process.env.REACT_APP_MAP_PROVIDER || 'leaflet').toLowerCase() !== 'google') return;
    let mounted = true;
    (async () => {
      try {
        if (typeof window === 'undefined') return;
        const mod = await import('@react-google-maps/api');
        if (!mounted) return;
        setGoogleComponents(mod);
        setGoogleLoaded(true);
      } catch (e) {
        if (mounted) setGoogleLoaded(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  const GoogleView = () => {
    if (!GoogleComponents) return null;
    const { LoadScript, GoogleMap, Marker } = GoogleComponents;
    const center = pos ? { lat: Number(pos[0]), lng: Number(pos[1]) } : { lat: 21.0278, lng: 105.8342 };
    return (
      <LoadScript googleMapsApiKey={process.env.REACT_APP_GOOGLE_MAPS_API_KEY}>
        <GoogleMap mapContainerStyle={{ height: '100%', width: '100%' }} center={center} zoom={13} onClick={(e) => setPos([e.latLng.lat(), e.latLng.lng()])}>
          {pos && <Marker position={center} />}
        </GoogleMap>
      </LoadScript>
    );
  };

  const mapProvider = (process.env.REACT_APP_MAP_PROVIDER || 'leaflet').toLowerCase();
  let mapContent = null;
  if (mapProvider === 'google') {
    if (!process.env.REACT_APP_GOOGLE_MAPS_API_KEY) {
      mapContent = (
        <div className="p-4">
          <p className="text-sm text-slate-600">Google Maps is selected as the provider but no `REACT_APP_GOOGLE_MAPS_API_KEY` is configured.</p>
          <p className="text-sm text-slate-600">To enable Google Maps: add your API key to `frontend/.env.local` as `REACT_APP_GOOGLE_MAPS_API_KEY=YOUR_KEY` and restart the frontend.</p>
          <div className="mt-3 grid grid-cols-2 gap-3">
            <input placeholder="Lat" value={pos ? pos[0] : ''} onChange={(e) => setPos([(e.target.value || '') , pos ? pos[1] : ''])} className="input-style" />
            <input placeholder="Lng" value={pos ? pos[1] : ''} onChange={(e) => setPos([pos ? pos[0] : '', (e.target.value || '')])} className="input-style" />
          </div>
        </div>
      );
    } else {
      mapContent = (googleLoaded ? <GoogleView /> : <div className="p-4"><p className="text-sm text-slate-600">Đang tải Google Maps…</p></div>);
    }
  } else {
    mapContent = (leafletLoaded ? <LeafletView /> : (
      <div className="p-4">
        <p className="text-sm text-slate-600">Trình duyệt thử nghiệm không hỗ trợ bản đồ tương tác; vui lòng nhập tọa độ thủ công hoặc dùng vị trí hiện tại.</p>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <input placeholder="Lat" value={pos ? pos[0] : ''} onChange={(e) => setPos([(e.target.value || '') , pos ? pos[1] : ''])} className="input-style" />
          <input placeholder="Lng" value={pos ? pos[1] : ''} onChange={(e) => setPos([pos ? pos[0] : '', (e.target.value || '')])} className="input-style" />
        </div>
      </div>
    ));

  }

  return (
    <ModalWrapper isOpen={!!isOpen} onClose={onClose} maxWidth="max-w-3xl">
      <div className="p-4">
        <h3 className="text-lg font-semibold mb-2">Chọn vị trí</h3>
        <div style={{ height: 400 }} className="mb-3 bg-slate-100 rounded">
          {mapContent}
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <button onClick={doUseCurrent} className="btn-secondary mr-2">Sử dụng vị trí hiện tại</button>
            <button onClick={() => { setPos(null); }} className="btn-secondary">Xóa</button>
          </div>
          <div>
            <button onClick={onClose} className="btn-secondary mr-2">Hủy</button>
            <button disabled={!pos} onClick={onManualSelect} className="btn-primary">Chọn vị trí</button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};

export default MapPickerModal;
