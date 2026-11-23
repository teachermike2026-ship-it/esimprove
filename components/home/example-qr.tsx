export function ExampleQr() {
  const modules: Array<{ x: number; y: number }> = [];
  const finderOrigins = [
    [0, 0],
    [14, 0],
    [0, 14],
  ];

  function inFinder(x: number, y: number): boolean {
    return finderOrigins.some(
      ([originX, originY]) =>
        x >= originX - 1 &&
        x <= originX + 7 &&
        y >= originY - 1 &&
        y <= originY + 7,
    );
  }

  for (let y = 0; y < 21; y += 1) {
    for (let x = 0; x < 21; x += 1) {
      if (inFinder(x, y)) continue;
      const hash = (x * 7 + y * 11 + x * y * 3) % 11;
      if (hash < 5) modules.push({ x, y });
    }
  }

  return (
    <div className="es-qr" role="img" aria-label="Example eSIM QR code">
      <svg viewBox="0 0 21 21" aria-hidden="true" focusable="false">
        <rect width="21" height="21" fill="#ffffff" />
        {modules.map((module) => (
          <rect
            key={`${module.x}-${module.y}`}
            x={module.x}
            y={module.y}
            width="1"
            height="1"
            fill="#11182C"
          />
        ))}
        {finderOrigins.map(([x, y]) => (
          <g key={`${x}-${y}`}>
            <rect x={x} y={y} width="7" height="7" fill="#11182C" />
            <rect x={x + 1} y={y + 1} width="5" height="5" fill="#ffffff" />
            <rect x={x + 2} y={y + 2} width="3" height="3" fill="#43B65B" />
          </g>
        ))}
      </svg>
    </div>
  );
}
