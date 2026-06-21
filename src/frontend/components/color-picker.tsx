"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  s /= 100;
  v /= 100;
  const f = (n: number) => {
    const k = (n + h / 60) % 6;
    return v - v * s * Math.max(0, Math.min(k, 4 - k, 1));
  };
  return [Math.round(f(5) * 255), Math.round(f(3) * 255), Math.round(f(1) * 255)];
}

function rgbToHex(r: number, g: number, b: number): string {
  return [r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("");
}

function hsvToHex(h: number, s: number, v: number): string {
  return rgbToHex(...hsvToRgb(h, s, v));
}

function hexToHsv(hex: string): [number, number, number] {
  if (hex.length !== 6) return [0, 100, 100];
  const r = parseInt(hex.slice(0, 2), 16) / 255;
  const g = parseInt(hex.slice(2, 4), 16) / 255;
  const b = parseInt(hex.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const v = max * 100;
  const s = max === 0 ? 0 : (d / max) * 100;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) * 60;
    else if (max === g) h = ((b - r) / d + 2) * 60;
    else h = ((r - g) / d + 4) * 60;
  }
  return [h, s, v];
}

const PRESETS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#14b8a6",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#64748b",
  "#0f172a",
];

interface ColorPickerProps {
  /** Hex color without the leading #, e.g. "ef4444". */
  value: string;
  onChange: (hex: string) => void;
}

export function ColorPicker({ value, onChange }: ColorPickerProps) {
  const hex = value.length === 6 ? value : "ef4444";

  const [hsv, setHsv] = useState<[number, number, number]>(() => hexToHsv(hex));
  const [hexInput, setHexInput] = useState(hex);

  // Mirrors `hsv` so drag handlers can read the latest value without
  // depending on `hsv` itself - otherwise their identity (and the global
  // mousemove/mouseup listeners below) would be recreated on every tick of
  // the drag, which is what was causing the lag.
  const hsvRef = useRef(hsv);
  useEffect(() => {
    hsvRef.current = hsv;
  }, [hsv]);

  const svRef = useRef<HTMLDivElement>(null);
  const hueRef = useRef<HTMLDivElement>(null);
  const draggingSV = useRef(false);
  const draggingHue = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingHexRef = useRef<string | null>(null);

  // Sync incoming value -> internal HSV, but only when it changed from
  // outside (not from our own drag/typing) - can't tell the difference
  // without storing HSV state and comparing, so this can't be plain
  // derived-on-render state.
  useEffect(() => {
    const incoming = value.length === 6 ? value : "ef4444";
    const current = hsvToHex(...hsvRef.current);
    if (incoming !== current) {
      setHsv(hexToHsv(incoming));
      setHexInput(incoming);
    }
  }, [value]);

  // Debounced external onChange - UI updates instantly, the action call waits 500ms
  const debouncedOnChange = useCallback(
    (newHex: string) => {
      pendingHexRef.current = newHex;
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      debounceTimer.current = setTimeout(() => {
        pendingHexRef.current = null;
        onChange(newHex);
      }, 500);
    },
    [onChange],
  );

  useEffect(
    () => () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
        if (pendingHexRef.current !== null) onChange(pendingHexRef.current);
      }
    },
    [onChange],
  );

  const commit = useCallback(
    (h: number, s: number, v: number) => {
      const newHex = hsvToHex(h, s, v);
      setHsv([h, s, v]);
      setHexInput(newHex);
      debouncedOnChange(newHex);
    },
    [debouncedOnChange],
  );

  const readSV = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!svRef.current) return;
      const rect = svRef.current.getBoundingClientRect();
      const s = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 100;
      const v = (1 - Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))) * 100;
      commit(hsvRef.current[0], s, v);
    },
    [commit],
  );

  const onSVMouseDown = (e: React.MouseEvent) => {
    draggingSV.current = true;
    readSV(e);
  };

  const readHue = useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!hueRef.current) return;
      const rect = hueRef.current.getBoundingClientRect();
      const h = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width)) * 360;
      commit(h, hsvRef.current[1], hsvRef.current[2]);
    },
    [commit],
  );

  const onHueMouseDown = (e: React.MouseEvent) => {
    draggingHue.current = true;
    readHue(e);
  };

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (draggingSV.current) readSV(e);
      if (draggingHue.current) readHue(e);
    };
    const onUp = () => {
      draggingSV.current = false;
      draggingHue.current = false;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [readSV, readHue]);

  const onHexChange = (raw: string) => {
    const clean = raw.replace(/[^0-9a-fA-F]/g, "").slice(0, 6);
    setHexInput(clean);
    if (clean.length === 6) {
      const [h, s, v] = hexToHsv(clean);
      setHsv([h, s, v]);
      debouncedOnChange(clean);
    }
  };

  const [h, s, v] = hsv;
  const pureHue = `hsl(${h}, 100%, 50%)`;
  const cursorX = `${s}%`;
  const cursorY = `${100 - v}%`;
  const hueX = `${(h / 360) * 100}%`;
  const displayHex = `#${hsvToHex(h, s, v)}`;

  return (
    <Popover>
      <PopoverTrigger
        className="flex h-9 w-full items-center gap-2.5 rounded-md border border-input bg-transparent px-3 text-left shadow-xs transition-colors hover:bg-primary/5"
        aria-label="Choisir une couleur"
      >
        <span
          className="h-5 w-5 shrink-0 rounded-md border border-black/10 shadow-xs"
          style={{ backgroundColor: displayHex }}
        />
        <span className="font-mono text-sm tracking-wider text-foreground uppercase">{displayHex}</span>
      </PopoverTrigger>

      <PopoverContent className="w-64 space-y-3 p-3" align="start" sideOffset={6}>
        <div
          ref={svRef}
          onMouseDown={onSVMouseDown}
          className="relative h-40 w-full cursor-crosshair select-none overflow-hidden rounded-lg"
          style={{
            background: `
              linear-gradient(to bottom, transparent, #000),
              linear-gradient(to right, #fff, ${pureHue})
            `,
          }}
        >
          <span
            className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
            style={{ left: cursorX, top: cursorY, backgroundColor: displayHex }}
          />
        </div>

        <div
          ref={hueRef}
          onMouseDown={onHueMouseDown}
          className="relative h-3 w-full cursor-pointer select-none rounded-full"
          style={{ background: "linear-gradient(to right,#f00,#ff0,#0f0,#0ff,#00f,#f0f,#f00)" }}
        >
          <span
            className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md"
            style={{ left: hueX, backgroundColor: pureHue }}
          />
        </div>

        <div className="flex items-center gap-2">
          <span
            className="h-8 w-8 shrink-0 rounded-lg border border-input shadow-xs"
            style={{ backgroundColor: displayHex }}
          />
          <div className="relative flex-1">
            <span className="absolute top-1/2 left-2.5 -translate-y-1/2 select-none font-mono text-xs text-muted-foreground">
              #
            </span>
            <input
              type="text"
              value={hexInput.toUpperCase()}
              onChange={(event) => onHexChange(event.target.value)}
              maxLength={6}
              className="flex h-8 w-full rounded-md border border-input bg-transparent pr-2 pl-6 font-mono text-xs text-foreground uppercase shadow-xs focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-hidden"
              spellCheck={false}
            />
          </div>
        </div>

        <div className="grid grid-cols-6 gap-1.5">
          {PRESETS.map((preset) => {
            const presetHex = preset.slice(1);
            const isActive = hsvToHex(h, s, v) === presetHex;
            return (
              <button
                key={preset}
                type="button"
                onClick={() => {
                  const [ph, ps, pv] = hexToHsv(presetHex);
                  commit(ph, ps, pv);
                }}
                className={`aspect-square w-full rounded-md border transition-all duration-150 hover:scale-110 ${
                  isActive ? "scale-110 border-foreground ring-1 ring-foreground" : "border-transparent"
                }`}
                style={{ backgroundColor: preset }}
                aria-label={preset}
              />
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
