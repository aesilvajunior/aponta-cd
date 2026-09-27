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
} from "./Icons";

// ============================================================
// Controles flutuantes do mapa
// ============================================================

export default function StockMapControls({
  view,
  onZoomIn,
  onZoomOut,
  onRotate,
  onRotateReset,
  onReset,
  onFullscreen,
  isFullscreen,
  layers,
  onToggleLayer,
  scaleLabel,
}) {
  const [layersOpen, setLayersOpen] = useState(false);

  return (
    <>
      {/* Zoom + rotação */}
      <div className="map-ctrl map-ctrl-top-right">
        <button
          className="map-ctrl-btn"
          onClick={onZoomIn}
          title="Aumentar zoom"
          aria-label="Zoom in"
        >
          <IconPlus size={18} strokeWidth={2} />
        </button>
        <div className="map-ctrl-divider" />
        <button
          className="map-ctrl-btn"
          onClick={onZoomOut}
          title="Diminuir zoom"
          aria-label="Zoom out"
        >
          <IconX size={18} strokeWidth={2} style={{ display: "none" }} />
          <span style={{ fontSize: 18, fontWeight: 300, lineHeight: 1 }}>−</span>
        </button>
      </div>

      {/* Bússola + reset + fullscreen */}
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
          title="Girar 90° no sentido horário"
          aria-label="Girar"
        >
          <IconRotateCcw size={16} style={{ transform: "scaleX(-1)" }} />
        </button>
      </div>

      {/* Reset + fullscreen + camadas */}
      <div className="map-ctrl map-ctrl-bottom-right">
        <button
          className="map-ctrl-btn"
          onClick={onReset}
          title="Voltar ao início"
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
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          aria-label="Fullscreen"
        >
          {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
        </button>
      </div>

      {/* Menu de camadas */}
      {layersOpen && (
        <div className="map-layers-panel">
          <div className="map-layers-title">Camadas</div>
          <label className="map-layers-item">
            <input
              type="checkbox"
              checked={layers.grid}
              onChange={() => onToggleLayer("grid")}
            />
            <IconGrid size={14} />
            <span>Grid de fundo</span>
          </label>
          <label className="map-layers-item">
            <input
              type="checkbox"
              checked={layers.labels}
              onChange={() => onToggleLayer("labels")}
            />
            <IconMapPin size={14} />
            <span>Rótulos das áreas</span>
          </label>
          <label className="map-layers-item">
            <input
              type="checkbox"
              checked={layers.occupancy}
              onChange={() => onToggleLayer("occupancy")}
            />
            <IconActivity size={14} />
            <span>Ocupação</span>
          </label>
        </div>
      )}

      {/* Escala */}
      <div className="map-scale">
        <div className="map-scale-bar" />
        <span className="map-scale-label">{scaleLabel}</span>
      </div>

      {/* Indicador de zoom */}
      <div className="map-zoom-badge">
        {Math.round(view.zoom * 100)}%
      </div>
    </>
  );
}