import { getTilt, getPlaceholderGradient } from "@/lib/utils";

interface PolaroidProps {
  id: string;
  photoUrl?: string | null;
  thumbUrl?: string | null;
  caption?: string;
  dateDot?: string;
  tilt?: boolean;
  tape?: boolean;
  width?: number;
  onClick?: () => void;
  className?: string;
}

export function Polaroid({
  id,
  photoUrl,
  thumbUrl,
  caption,
  dateDot,
  tilt = true,
  tape = false,
  width,
  onClick,
  className = "",
}: PolaroidProps) {
  const tiltDeg = tilt ? getTilt(id) : 0;
  const bg = photoUrl || thumbUrl
    ? undefined
    : getPlaceholderGradient(id);

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-[7px] border-0 p-[8px_8px_12px] bg-polaroid cursor-pointer text-left ${className}`}
      style={{
        transform: `rotate(${tiltDeg}deg)`,
        boxShadow: "0 10px 20px -12px rgba(60,40,20,.42)",
        width: width ? `${width}px` : undefined,
      }}
    >
      {tape && (
        <span
          className="absolute top-[-9px] left-1/2 w-[54px] h-[18px] -translate-x-1/2 z-10"
          style={{ background: "rgba(222,208,170,.8)", transform: "translateX(-50%) rotate(3deg)" }}
        />
      )}
      <div
        className="relative aspect-square w-full overflow-hidden"
        style={{ background: bg }}
      >
        {(photoUrl || thumbUrl) && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbUrl || photoUrl!}
            alt={caption || ""}
            className="w-full h-full object-cover"
          />
        )}
      </div>
      {caption && (
        <div
          className="font-hand text-[19px] leading-none text-ink-hand whitespace-nowrap overflow-hidden text-ellipsis"
        >
          {caption}
        </div>
      )}
      {dateDot && (
        <div className="text-[11px] text-ink-3 whitespace-nowrap overflow-hidden text-ellipsis">
          {dateDot}
        </div>
      )}
    </button>
  );
}
