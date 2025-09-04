if (window.Chart && window.ChartZoom) {
  Chart.register(ChartZoom);
} else {
  console.warn('chartjs-plugin-zoom not found');
}

const ELEMENT_CSV = (key) => `./data/elements/${key}.csv`;
const ELEMENT_COL = {
  H: "rgb(220, 20, 60)",
  He: "rgb(138, 43, 226)",
  C:  "rgb(105, 105, 105)",
  O:  "rgb(30, 144, 255)",
  Na: "rgb(218, 165, 32)",
  Mg: "rgb(34, 139, 34)",
  Ca: "rgb(205, 92, 92)",
  Cr: "rgb(0, 128, 128)",
  Fe: "rgb(160, 82, 45)"
};
const elementCache = new Map();

function wavelengthToRGB(wavelength) {
  let R = 0, G = 0, B = 0, alpha = 1;

  if (wavelength >= 380 && wavelength < 440) {
    const attenuation = 0.1 + 0.7 * (wavelength - 380) / (440 - 380)
    R = (-(wavelength - 440) / (440 - 380))*attenuation;
    G = 0;
    B = attenuation;
  } else if (wavelength >= 440 && wavelength < 490) {
    R = 0;
    G = (wavelength - 440) / (490 - 440);
    B = 1;
  } else if (wavelength >= 490 && wavelength < 510) {
    R = 0;
    G = 1;
    B = -(wavelength - 510) / (510 - 490);
  } else if (wavelength >= 510 && wavelength < 580) {
    R = (wavelength - 510) / (580 - 510);
    G = 1;
    B = 0;
  } else if (wavelength >= 580 && wavelength < 645) {
    R = 1;
    G = -(wavelength - 645) / (645 - 580);
    B = 0;
  } else if (wavelength >= 645 && wavelength <= 780) {
    R = 0.3 + 0.7 * (750 - wavelength) / (750 - 645)
    G = 0;
    B = 0;
  } else {
    alpha = 0; // außerhalb sichtbaren Bereichs, transparent
  }

  // Gamma-Korrektur
  const gamma = 0.8;
  R = Math.pow(R * alpha, gamma);
  G = Math.pow(G * alpha, gamma);
  B = Math.pow(B * alpha, gamma);

  // In 0-255 umwandeln
  return {
    r: Math.round(R * 255),
    g: Math.round(G * 255),
    b: Math.round(B * 255)
  };
}

function drawStarColor(r, g, b) {
  const canvas = document.getElementById('starCanvas');
  const ctx = canvas.getContext('2d');
  const centerX = canvas.width / 2;
  const centerY = canvas.height / 2;
  const radius = 50;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Create radial gradient for glowing star
  const gradient = ctx.createRadialGradient(centerX, centerY, radius * 0.1, centerX, centerY, radius);
  gradient.addColorStop(0, `rgba(${r},${g},${b},1)`);
  gradient.addColorStop(0.5, `rgba(${r},${g},${b},0.6)`);
  gradient.addColorStop(1, 'rgba(0,0,0,0)');

  // Draw glowing circle
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
  ctx.fillStyle = gradient;
  ctx.fill();

  // Optional: Add a small bright core circle for the star center
  ctx.beginPath();
  ctx.arc(centerX, centerY, radius * 0.2, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(${r},${g},${b},1)`;
  ctx.shadowColor = `rgba(${r},${g},${b},0.8)`;
  ctx.shadowBlur = 20;
  ctx.fill();
}

// Calculate weighted average RGB color for visible wavelengths (380-780 nm)
function weightedAverageColor(wavelengths, intensities) {
  let sumR = 0, sumG = 0, sumB = 0;

  for (let i = 0; i < wavelengths.length; i++) {
    const wl = wavelengths[i];
    if (wl >= 380 && wl <= 780) {
      const intensity = intensities[i];
      const color = wavelengthToRGB(wl);
      sumR += color.r * intensity;
      sumG += color.g * intensity;
      sumB += color.b * intensity;
    }
  }
  let totalIntensity = Math.max(sumR,sumG,sumB);

  return {
    r: Math.round(sumR / totalIntensity * 255),
    g: Math.round(sumG / totalIntensity * 255),
    b: Math.round(sumB / totalIntensity * 255),
  };
}

function loadSpectrum(csvpath) {
  fetch(csvpath)
  .then(response => {
    if (!response.ok) {
        throw new Error('Fehler beim Laden der CSV: ' + response.status + ' ' + response.statusText);
    }
    return response.text();
})
.then(text => {
    const lines = text.trim().split('\n');

    // Arrays für Chart-Daten
    const wavelengths = [];
    const intensities = [];

    // Erste Zeile ist meist Header, also ab i = 1
    for (let i = 1; i < lines.length; i++) {
        const [w, f] = lines[i].split(',').map(Number);
        wavelengths.push(w);
        intensities.push(f);
    }

    const maxIntensity = Math.max(...intensities);
    const normIntensities = intensities.map(i => i / maxIntensity);
    const indices = [];

    const visibleRangeBackground = { 
      id: 'visibleRangeBackground',
      beforeDraw: (chart) => {
        const { ctx, chartArea, scales } = chart;
          const xMin = 380;
          const xMax = 780;
          const left = scales.x.getPixelForValue(xMin);
          const right = scales.x.getPixelForValue(xMax);
          const top = chartArea.top;
          const bottom = chartArea.bottom;
          const height = bottom - top;

          // Create gradient across the visible spectrum
          const gradient = ctx.createLinearGradient(left, 0, right, 0);

          // Use multiple stops for smoothness
          const stops = 200; // more stops = smoother color transitions
          let maxint = 0;
          for (let i = 0; i <= stops; i++) {
            const wl = xMin + (i / stops) * (xMax - xMin);

            // Find closest intensity value
            let closestIndex = 0;
            let minDiff = Infinity;
            for (let j = 0; j < wavelengths.length; j++) {
              const diff = Math.abs(wavelengths[j] - wl);
              if (diff < minDiff) {
                minDiff = diff;
                closestIndex = j;
              }
            }
            indices.push(closestIndex)
            if (normIntensities[closestIndex] > maxint) {
              maxint = normIntensities[closestIndex];
            }
          }
          for (let i = 0; i <= stops; i++) {
            const wl = xMin + (i / stops) * (xMax - xMin);
            const intensity = normIntensities[indices[i]]/maxint;
            const color = wavelengthToRGB(wl);

            const r = Math.min(255, Math.round(color.r * intensity));
            const g = Math.min(255, Math.round(color.g * intensity));
            const b = Math.min(255, Math.round(color.b * intensity));

            gradient.addColorStop(i / stops, `rgb(${r},${g},${b})`);
          }
          // Fill the area with the gradient
          ctx.save();
          ctx.fillStyle = gradient;
          ctx.fillRect(left, top, right - left, height);
          ctx.restore();
      }
    };

    const drawStarPlugin = {
      id: 'drawStar',
      afterDraw: (chart) => {
        const { ctx, chartArea } = chart;
        const starCanvas = document.getElementById('starCanvas');
        if (!starCanvas) return;

        const size = 100; // pixels
        const x = chartArea.right - size - 1; // 10px padding from right
        const y = chartArea.top + 1; // 10px padding from top
        ctx.save();
        ctx.fillStyle = 'black';
        ctx.fillRect(x, y, size, size);
        ctx.restore();
        ctx.save();
        ctx.drawImage(starCanvas, x, y, size, size);
        ctx.restore();
      }
    };


    // Chart.js Diagramm erstellen
    const ctx = document.getElementById('spectrumChart').getContext('2d');

    if (spectrumChart) {
        spectrumChart.destroy();
    }
    spectrumChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: wavelengths,
            datasets: [{
                label: 'Vega-Spektrum',
                data: normIntensities,
                borderColor: 'rgb(255, 255, 255)',
                borderWidth: 2,
                pointRadius: 0, // keine Punkte, nur Linie
            }]
        },
        options: {
            responsive: true,
            plugins: {
              legend: {
                  display: false
              },
              zoom: {
                zoom:{
                  drag: { 
                    enabled: true,
                    backgroundColor: 'rgba(255,255,255,0.08)',
                  },
                  pinch: { enabled: true },
                  mode: 'xy'
                },
                pan: {
                  enabled: false,
                  mode: 'x'
                }
              } 
            },
            scales: {
                x: {
                    grid: {
                        color: 'rgba(255,255,255,0.2)' // faint white gridlines
                    },
                    type: 'linear',
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14
                        }
                    },
                    title: {
                        display: true,
                        text: 'Wellenlänge (nm)',
                        color: "white",
                        font: {
                            size: 18
                        }
                    },
                    min: 100,
                    max: 1500
                    /* min: 380,
                    max: 780 */
                },
                y: {
                    grid: {
                        color: 'rgba(255, 255, 255, 0.2)' // faint white gridlines
                    },
                    type: 'linear',
                    ticks: {
                        color: 'white',
                        font: {
                            size: 14
                        }
                    },
                    title: {
                        display: true,
                        text: 'Intensität',
                        color: "white",
                        font: {
                            size: 18
                        }
                    },
                    min: 0,
                    max: 1
                }
            }
        },
        plugins: [visibleRangeBackground, drawStarPlugin]
    });
    syncElementVisibilityFromUI();
    const avgColor = weightedAverageColor(wavelengths, intensities);
    drawStarColor(avgColor.r, avgColor.g, avgColor.b);
  })
  .catch(err => {
    console.error('Fehler beim Laden der CSV:', err);
  });
}

function buildElementDataset(elementKey, wavelengths) {
  const data = [];
  const color = ELEMENT_COL[elementKey];
  for (const wl of wavelengths) { data.push({ x: wl, y: 0 }, { x: wl, y: 1 }, { x: wl, y: null }); }
  return {
    label: `Lines: ${elementKey}`,
    type: 'line',
    data,
    parsing: false,
    pointRadius: 0,
    showLine: true,
    borderColor: color,
    borderWidth: 1,
    spanGaps: false,
  };
}

async function syncElementVisibilityFromUI() {
  if (!spectrumChart) return;
  const tasks = [];
  document.querySelectorAll('.line-toggle').forEach(cb => {
    const key = cb.value;
    tasks.push(toggleElementDataset(key, cb.checked)); // creates if missing, hides if unchecked
  });
  await Promise.all(tasks);
}

async function getElementWavelengths(elementKey) {
  if (elementCache.has(elementKey)) return elementCache.get(elementKey);
  const res = await fetch(ELEMENT_CSV(elementKey));
  if (!res.ok) throw new Error(`Element CSV not found: ${elementKey}`);
  const text = await res.text();
  const lines = text.trim().split('\n');
  const out = [];
  for (let i = 1; i < lines.length; i++) { // skip header
    const v = Number(lines[i].split(',')[0]); // first column: wavelength in nm
    if (Number.isFinite(v)) out.push(v);
  }
  elementCache.set(elementKey, out);
  return out;
}

async function toggleElementDataset(elementKey, visible) {
  if (!spectrumChart) return;
  let ds = spectrumChart.data.datasets.find(d => d.label === `Lines: ${elementKey}`);
  if (!ds && visible) {
    const wavelengths = await getElementWavelengths(elementKey);
    ds = buildElementDataset(elementKey, wavelengths);
    spectrumChart.data.datasets.push(ds);
  }
  if (ds) ds.hidden = !visible;
  spectrumChart.update('none');
}

let spectrumChart = null;

const csvSelect = document.getElementById('csvSelect');
loadSpectrum(csvSelect.value)

csvSelect.addEventListener('change', () => {
    loadSpectrum(csvSelect.value);
});

document.getElementById('resetZoomBtn').addEventListener('click', () => {
  if (spectrumChart && spectrumChart.resetZoom) {
    spectrumChart.resetZoom();
  }
});

document.querySelectorAll('.line-toggle').forEach(cb => {
  cb.addEventListener('change', async (e) => {
    const key = e.target.value;          // e.g., "H"
    const on = e.target.checked;
    try { await toggleElementDataset(key, on); }
    catch (err) { console.error(err); }
  });
});