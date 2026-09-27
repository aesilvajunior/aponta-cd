import React, { useState } from "react";
import {
  IconPlus,
  IconX,
  IconRotateCcw,
  IconMaximize,
  IconMinimize,
  IconGrid,
  IconMapPin,
  IconLayers,
  IconActivity,
  IconArrowLeftRight,
} from "./Icons";

export default function StockMapControls({
  view,
  onZoomIn,
  onZoomOut,
  onRotate,
  onRotateReset,
  onRotateSet,
  onReset,
  onFullscreen,
  isFullscreen,
  layers,
  onToggleLayer,
  scaleLabel,
}) {
  const [layersOpen, setLayersOpen] = useState(false);
  const [rotateOpen, setRotateOpen] = useState(false);

  // Slider de rotação livre
  function handleRotateSlider(e) {
    const val = Number(e.target.value);
    onRotateSet(val);
  }

  return (
    <>
      {/* Zoom */}
      <div className="map-ctrl map-ctrl-top-right">
        <button
          className="map-ctrl-btn"
          onClick={onZoomIn}
          title="Aumentar zoom (+)"
          aria-label="Zoom in"
        >
          <IconPlus size={18} strokeWidth={2} />
        </button>
        <div className="map-ctrl-divider" />
        <button
          className="map-ctrl-btn"
          onClick={onZoomOut}
          title="Diminuir zoom (−)"
          aria-label="Zoom out"
        >
          <span style={{ fontSize: 18, fontWeight: 300, lineHeight: 1 }}>−</span>
        </button>
      </div>

      {/* Bússola + reset rotação + girar 90 + slider */}
      <div className="map-ctrl map-ctrl-top-right-2">
        <button
          className="map-ctrl-btn map-compass"
          onClick={onRotateReset}
          title="Resetar rotação para 0°"
          aria-label="Compass"
        >
          <div
            className="map-compass-needle"
            style={{
              transform: `rotate(${-view.rotation}deg)`,
              transition: "transform 300ms cubic-bezier(0.4, 0, 0.2, 1)",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <polygon points="12,2 15,10 12,9 9,10" fill="#ef4444" />
              <polygon points="12,22 9,14 12,15 15,14" fill="#94a3b8" />
            </svg>
          </div>
        </button>
        <div className="map-ctrl-divider" />
        <button
          className="map-ctrl-btn"
          onClick={onRotate}
          title="Girar 90° no sentido horário (G)"
          aria-label="Girar 90"
        >
          <IconRotateCcw size={16} style={{ transform: "scaleX(-1)" }} />
        </button>
        <div className="map-ctrl-divider" />
        <button
          className="map-ctrl-btn"
          onClick={() => setRotateOpen((v) => !v)}
          title="Rotação livre"
          aria-label="Slider de rotação"
          style={{ background: rotateOpen ? "rgba(0, 212, 255, 0.2)" : "transparent" }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3a9 9 0 1 0 9 9" />
            <polyline points="21 3 21 9 15 9" />
          </svg>
        </button>
      </div>

      {/* Slider de rotação (painel expandido) */}
      {rotateOpen && (
        <div className="map-rotate-panel">
          <div className="map-rotate-label">
            <span>Rotação</span>
            <span className="map-rotate-value">{Math.round(view.rotation)}°</span>
          </div>
          <input
            type="range"
            min="-180"
            max="180"
            step="1"
            value={view.rotation}
            onChange={handleRotateSlider}
            className="map-rotate-slider"
          />
          <div className="map-rotate-presets">
            {[0, 45, 90, 135, 180, -90].map((deg) => (
              <button
                key={deg}
                className={`map-rotate-preset ${view.rotation === deg ? "active" : ""}`}
                onClick={() => onRotateSet(deg)}
              >
                {deg}°
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Reset + fullscreen + camadas */}
      <div className="map-ctrl map-ctrl-bottom-right">
        <button
          className="map-ctrl-btn"
          onClick={onReset}
          title="Voltar ao início (R)"
          aria-label="Resetar visão"
        >
          <IconMapPin size={16} />
        </button>
        <div className="map-ctrl-divider" />
        <button
          className="map-ctrl-btn"
          onClick={() => setLayersOpen((v) => !v)}
          title="Camadas"
          aria-label="Camadas"
        >
          <IconLayers size={16} />
        </button>
        <div className="map-ctrl-divider" />
        <button
          className="map-ctrl-btn"
          onClick={onFullscreen}
          title={isFullscreen ? "Sair da tela cheia (F)" : "Tela cheia (F)"}
          aria-label="Fullscreen"
        >
          {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
        </button>
      </div>

      {layersOpen && (
        <div className="map-layers-panel">
          <div className="map-layers-title">Camadas</div>
          <label className="map-layers-item">
            <input type="checkbox" checked={layers.grid} onChange={() => onToggleLayer("grid")} />
            <IconGrid size={14} />
            <span>Grid de fundo</span>
          </label>
          <label className="map-layers-item">
            <input type="checkbox" checked={layers.labels} onChange={() => onToggleLayer("labels")} />
            <IconMapPin size={14} />
            <span>Rótulos das áreas</span>
          </label>
          <label className="map-layers-item">
            <input type="checkbox" checked={layers.occupancy} onChange={() => onToggleLayer("occupancy")} />
            <IconActivity size={14} />
            <span>Ocupação</span>
          </label>
          <label className="map-layers-item">
            <input type="checkbox" checked={layers.corridorFlow} onChange={() => onToggleLayer("corridorFlow")} />
            <IconArrowLeftRight size={14} />
            <span>Fluxo dos corredores</span>
          </label>
        </div>
      )}

      <div className="map-scale">
        <div className="map-scale-bar" />
        <span className="map-scale-label">{scaleLabel}</span>
      </div>

      <div className="map-zoom-badge">
        {Math.round(view.zoom * 100)}%
      </div>
    </>
  );
}