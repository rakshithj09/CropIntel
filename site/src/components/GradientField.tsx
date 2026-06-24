/**
 * Large, soft, blurred radial blobs sitting behind glass cards — cluely's
 * bg-purple/bg-pink/bg-blue layers, in our cool + sage + warm palette.
 * Decorative only.
 */
export default function GradientField({
  className = "",
}: {
  className?: string;
}) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}
    >
      <div
        className="blob bg-grad-1"
        style={{ width: 560, height: 560, top: -140, left: -100 }}
      />
      <div
        className="blob bg-grad-2"
        style={{ width: 480, height: 480, top: 40, right: -120, opacity: 0.5 }}
      />
      <div
        className="blob bg-grad-3"
        style={{ width: 420, height: 420, bottom: -160, left: "35%", opacity: 0.45 }}
      />
    </div>
  );
}
