import { getPlaceholderGradient, formatFilmDate } from "@/lib/utils";

interface PolaroidProps {
  id: string;
  photoUrl?: string | null;
  thumbUrl?: string | null;
  caption?: string;
  date?: string; // YYYY-MM-DD
  dateDot?: string;
  width?: number;
  onClick?: () => void;
  className?: string;
}

export function Polaroid({
  id,
  photoUrl,
  thumbUrl,
  caption,
  date,
  dateDot,
  width,
  onClick,
  className = "",
}: PolaroidProps) {
  const bg = photoUrl || thumbUrl
    ? undefined
    : getPlaceholderGradient(id);

  return (
    <button
      onClick={onClick}
      className={`relative flex flex-col gap-[7px] border-0 p-[8px_8px_12px] bg-polaroid cursor-pointer text-left ${className}`}
      style={{
        boxShadow: "0 10px 20px -12px rgba(60,40,20,.42)",
        width: width ? `${width}px` : undefined,
      }}
    >
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
        {date && (
          <span
            className="absolute bottom-[6px] right-[7px] font-mono text-[11px] leading-none select-none"
            style={{ color: "#FF8C00", textShadow: "0 0 6px rgba(0,0,0,.5)" }}
          >
            {formatFilmDate(date)}
          </span>
        )}
      </div>
      {caption && (
        <div className="text-[14px] leading-tight text-ink-2 whitespace-nowrap overflow-hidden text-ellipsis">
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
