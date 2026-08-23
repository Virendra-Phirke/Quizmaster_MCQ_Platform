import { useEffect, useRef } from "react";

interface SquaresProps {
  speed?: number;
  squareSize?: number;
  direction?: "diagonal" | "right" | "left";
  borderColor?: string;
  className?: string;
}

export default function Squares({
  speed = 0.5,
  squareSize = 40,
  direction = "diagonal",
  borderColor = "rgba(255, 255, 255, 0.1)",
  className = "",
}: SquaresProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Set canvas size to window size
    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    let time = 0;
    let animationId: number;

    const animate = () => {
      ctx.fillStyle = "rgba(0, 0, 0, 0)";
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      ctx.strokeStyle = borderColor;
      ctx.lineWidth = 1;

      const cols = Math.ceil(canvas.width / squareSize) + 1;
      const rows = Math.ceil(canvas.height / squareSize) + 1;

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          let x = col * squareSize;
          let y = row * squareSize;

          // Apply directional offset based on time
          if (direction === "diagonal") {
            x += time * speed;
            y += time * speed;
          } else if (direction === "right") {
            x += time * speed;
          } else if (direction === "left") {
            x -= time * speed;
          }

          // Wrap around
          x = ((x % (squareSize * cols)) + squareSize * cols) % (squareSize * cols);
          y = ((y % (squareSize * rows)) + squareSize * rows) % (squareSize * rows);

          ctx.strokeRect(x, y, squareSize, squareSize);
        }
      }

      time += 1;
      animationId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [speed, squareSize, direction, borderColor]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none ${className}`}
      style={{ zIndex: 0 }}
    />
  );
}
