import { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser } from 'lucide-react';

interface SignaturePadProps {
  onChange: (data: string | null) => void;
  value?: string | null;
  disabled?: boolean;
}

export function SignaturePad({ onChange, value = null, disabled = false }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const hasStrokesRef = useRef(false);
  const restoredValueRef = useRef<string | null>(null);
  const [hasStrokes, setHasStrokes] = useState(false);

  const getCtx = useCallback((): CanvasRenderingContext2D | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    return ctx;
  }, []);

  const drawImageOnCanvas = useCallback((dataUrl: string) => {
    const canvas = canvasRef.current;
    const ctx = getCtx();
    if (!canvas || !ctx) return;
    const dpr = window.devicePixelRatio || 1;
    const img = new Image();
    img.onload = () => {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);
      ctx.drawImage(img, 0, 0, canvas.width / dpr, canvas.height / dpr);
      hasStrokesRef.current = true;
      setHasStrokes(true);
    };
    img.src = dataUrl;
  }, [getCtx]);

  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const ctx = getCtx();
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#1e293b';
    ctx.lineWidth = 2;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    hasStrokesRef.current = false;
    setHasStrokes(false);
  }, [getCtx]);

  useEffect(() => {
    setupCanvas();

    if (value) {
      restoredValueRef.current = value;
      drawImageOnCanvas(value);
    }

    const handleResize = () => {
      if (hasStrokesRef.current) {
        const dataUrl = canvasRef.current?.toDataURL('image/png') ?? null;
        setupCanvas();
        if (dataUrl) {
          drawImageOnCanvas(dataUrl);
        }
      } else {
        setupCanvas();
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setupCanvas, getCtx, drawImageOnCanvas]);

  useEffect(() => {
    if (value && value !== restoredValueRef.current) {
      restoredValueRef.current = value;
      drawImageOnCanvas(value);
    } else if (!value && restoredValueRef.current) {
      restoredValueRef.current = null;
      const ctx = getCtx();
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (ctx && canvas && container) {
        const rect = container.getBoundingClientRect();
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, rect.width, rect.height);
      }
      hasStrokesRef.current = false;
      setHasStrokes(false);
    }
  }, [value, drawImageOnCanvas, getCtx]);

  const getPointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx) return;
    const pos = getPointerPos(e);
    isDrawingRef.current = true;
    lastPointRef.current = pos;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    canvasRef.current?.setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled || !isDrawingRef.current) return;
    e.preventDefault();
    const ctx = getCtx();
    if (!ctx || !lastPointRef.current) return;
    const pos = getPointerPos(e);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    lastPointRef.current = pos;
    if (!hasStrokesRef.current) {
      hasStrokesRef.current = true;
      setHasStrokes(true);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (disabled) return;
    e.preventDefault();
    isDrawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
    if (hasStrokesRef.current) {
      const dataUrl = canvasRef.current?.toDataURL('image/png');
      if (dataUrl) {
        restoredValueRef.current = dataUrl;
        onChange(dataUrl);
      }
    }
  };

  const handlePointerLeave = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (isDrawingRef.current) {
      handlePointerUp(e);
    }
  };

  const handleClear = () => {
    const ctx = getCtx();
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!ctx || !canvas || !container) return;
    const rect = container.getBoundingClientRect();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, rect.width, rect.height);
    hasStrokesRef.current = false;
    setHasStrokes(false);
    restoredValueRef.current = null;
    onChange(null);
  };

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className="relative rounded-lg border-2 border-dashed border-neutral-300 bg-white"
        style={{ height: '180px' }}
      >
        <canvas
          ref={canvasRef}
          className="block h-full w-full touch-none rounded-lg"
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerLeave}
          style={{ cursor: disabled ? 'not-allowed' : 'crosshair' }}
        />
        {!hasStrokes && !disabled && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="text-sm text-neutral-400">Firme aquí con el mouse o el dedo</span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <span className={`text-xs ${hasStrokes ? 'text-success-600' : 'text-neutral-400'}`}>
          {hasStrokes ? 'Firma capturada' : 'Sin firmar'}
        </span>
        <button
          type="button"
          onClick={handleClear}
          disabled={disabled || !hasStrokes}
          className="inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium text-neutral-600 transition-colors hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Eraser className="h-3.5 w-3.5" />
          Limpiar
        </button>
      </div>
    </div>
  );
}
