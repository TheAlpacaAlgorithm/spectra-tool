function resizeOverlay() {
  const overlay = document.getElementById('overlayCanvas');
  overlay.width = window.innerWidth;
  overlay.height = window.innerHeight;
}

function wavelengthToRGB(wavelength) {
  let R = 0, G = 0, B = 0, alpha = 1;

  if (wavelength >= 380 && wavelength < 440) {
    attenuation = 0.1 + 0.7 * (wavelength - 380) / (440 - 380)
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

function drawColorBar(wavelengths, intensities) {
  const canvas = document.getElementById('colorBar');
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;

  // Hintergrund löschen
  ctx.clearRect(0, 0, width, height);

  // Breite pro Pixel
  const pixels = width;
  for (let i = 0; i < pixels; i++) {
    // Wellenlänge für Pixel berechnen (linear zwischen 380nm und 780nm)
    const wl = 380 + (i / pixels) * (780 - 380);

    // Nächste Intensität im Datensatz finden (vereinfachte Annahme)
    // Wir nehmen den Wert mit minimalem Abstand zu wl
    let closestIndex = 0;
    let minDiff = Infinity;
    for (let j = 0; j < wavelengths.length; j++) {
      const diff = Math.abs(wavelengths[j] - wl);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = j;
      }
    }
    const intensity = intensities[closestIndex];
    // Farbe bestimmen
    const color = wavelengthToRGB(wl);
    // Farbe mit Intensität multiplizieren
    const r = Math.min(255, Math.round(color.r * intensity));
    const g = Math.min(255, Math.round(color.g * intensity));
    const b = Math.min(255, Math.round(color.b * intensity));

    ctx.fillStyle = `rgb(${r},${g},${b})`;
    ctx.fillRect(i, 0, 1, height);
  }
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


// CSV-Datei laden und anzeigen
fetch('../data/vega/vega_002.csv')
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
        wavelengths.push(w/10);
        intensities.push(f);
    }

    const maxIntensity = Math.max(...intensities);
    const normIntensities = intensities.map(i => i / maxIntensity);

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

    const width = right - left;

    for (let i = 0; i < width; i++) {
      // Berechne Wellenlänge für Pixel
      const wl = xMin + (i / width) * (xMax - xMin);

      // Suche Intensität (minimale Differenz)
      let closestIndex = 0;
      let minDiff = Infinity;
      for (let j = 0; j < wavelengths.length; j++) {
        const diff = Math.abs(wavelengths[j] - wl);
        if (diff < minDiff) {
          minDiff = diff;
          closestIndex = j;
        }
      }
      const intensity = normIntensities[closestIndex];
      // Farbe mit deiner wavelengthToRGB-Funktion
      const color = wavelengthToRGB(wl);

      const r = Math.min(255, Math.round(color.r * intensity));
      const g = Math.min(255, Math.round(color.g * intensity));
      const b = Math.min(255, Math.round(color.b * intensity));

      ctx.fillStyle = `rgb(${r},${g},${b})`;
      ctx.fillRect(left + i, top, 1, height);
    }
  }
};


    // Chart.js Diagramm erstellen
    const ctx = document.getElementById('spectrumChart').getContext('2d');

    const spectrumChart = new Chart(ctx, {
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
        plugins: [visibleRangeBackground]
    });
    const avgColor = weightedAverageColor(wavelengths, intensities);
    drawStarColor(avgColor.r, avgColor.g, avgColor.b);
  })
  .catch(err => {
    console.error('Fehler beim Laden der CSV:', err);
  });