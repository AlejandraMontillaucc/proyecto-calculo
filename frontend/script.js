"use strict";

// Configuración general del frontend
// Comentarios en español, código y nombres en inglés

// URL base del backend Flask
// Permite configurar el backend desde una variable global si fuera necesario
// Backend base URL (lógica original): usa APP_BASE_URL o 127.0.0.1:5000
const BASE_URL = window.APP_BASE_URL || "http://127.0.0.1:5000";

// Referencias a elementos del DOM
// Comentario: Permitir id="function" (nuevo) o id="expression" (compatibilidad)
const expressionInput = document.getElementById("function") || document.getElementById("expression");
const constraintInput = document.getElementById("constraint");
const x0Input = document.getElementById("x0");
const y0Input = document.getElementById("y0");
const xMinInput = document.getElementById("xMin");
const xMaxInput = document.getElementById("xMax");
const yMinInput = document.getElementById("yMin");
const yMaxInput = document.getElementById("yMax");
const resultsBox = document.getElementById("results");
const stepsBox = document.getElementById("process") || document.getElementById("steps");
const graphDiv = document.getElementById("graph");
const graphExplBox = document.getElementById("graph-expl");

// Renderizado KaTeX: utilitario centralizado
function renderMathAll(targets = []) {
  try {
    const opts = {
      delimiters: [
        { left: '$$', right: '$$', display: true },
        { left: '\\(', right: '\\)', display: false },
        { left: '\\[', right: '\\]', display: true }
      ],
      throwOnError: false,
      strict: 'warn',
      errorCallback: function (msg) { console.warn('KaTeX:', msg); }
    };
    if (!Array.isArray(targets) || targets.length === 0) targets = [document.body];
    for (const el of targets) {
      try {
        if (typeof renderMathInElement === 'function') {
          renderMathInElement(el, opts);
        }
      } catch (e) {
        const warn = document.createElement('p');
        warn.style.color = '#b75a00';
        warn.textContent = '⚠️ No se pudo mostrar esta expresión. Verifica la función ingresada.';
        el.appendChild(warn);
      }
    }
  } catch (_) { /* silencioso */ }
}

// Limpieza y envoltura segura de LaTeX
function sanitizeLatex(str) {
  if (!str) return "";
  return String(str)
    .replace(/\u000c|\f/g, '') // limpia caracteres invisibles
    .replace(/\\\\/g, '\\') // corrige dobles backslashes
    .replace(/\{\s*/g, '{')
    .replace(/\s*\}/g, '}')
    .replace(/\$\$/g, '$$'); // asegura delimitadores dobles
}

function hasDelimiters(s) {
  const t = String(s || '').trim();
  return (t.startsWith('$$') && t.endsWith('$$')) || (t.startsWith('\\(') && t.endsWith('\\)')) || (t.startsWith('\\[') && t.endsWith('\\]'));
}

// Convierte segmentos $...$ a \(...\) para evitar errores dentro de $$...$$
function normalizeLatexDelimiters(s) {
  if (!s) return '';
  return String(s).replace(/(^|[^\\])\$(.+?)\$/g, (m, pre, inner) => `${pre}\\(${inner}\\)`);
}

// Normaliza operadores textuales a notación LaTeX adecuada
function normalizeOperatorsLatex(s) {
  if (!s) return '';
  let out = String(s);
  // Reemplaza 'div' como operador de divergencia solo si no está ya escapado (no \div)
  out = out.replace(/(^|[^\\])\bdiv\b/g, '$1\\operatorname{div}');
  return out;
}

function ensureBlockLatex(s) {
  const clean = sanitizeLatex(s);
  let normalized = normalizeLatexDelimiters(clean);
  // Si ya viene completamente delimitado, respetar
  if (hasDelimiters(normalized)) return normalized;
  // Evitar anidar delimitadores inline dentro de un bloque
  normalized = normalized.replace(/\\\(/g, '').replace(/\\\)/g, '')
                         .replace(/\\\[/g, '').replace(/\\\]/g, '');
  // Ajustar operadores como 'div' a \operatorname{div}
  normalized = normalizeOperatorsLatex(normalized);
  return `$$ ${normalized} $$`;
}

// Inyecta HTML limpio y re-renderiza con KaTeX
function updateMathContainer(containerId, htmlContent) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = sanitizeLatex(htmlContent);
  setTimeout(() => {
    if (typeof renderMathInElement === 'function') {
      renderMathInElement(container, {
        delimiters: [
          { left: '$$', right: '$$', display: true },
          { left: '\\(', right: '\\)', display: false },
          { left: '\\[', right: '\\]', display: true }
        ],
        throwOnError: false
      });
    }
  }, 50);
}

// Botones
const btnPartials = document.getElementById("btn-partials");
const btnGradient = document.getElementById("btn-gradient");
const btnEvaluate = document.getElementById("btn-evaluate");
const btnDoubleIntegral = document.getElementById("btn-double-integral");
const btnLagrange = document.getElementById("btn-lagrange");
const btnOptimize = document.getElementById("btn-optimize");
const btnAnalyzeDomain = document.getElementById("btn-analyze-domain");

// Plotly y Math.js se cargan de forma estática desde index/operations.html
// No es necesario cargar Plotly dinámicamente aquí.

// Helper para mostrar resultados formateados
function showResult(obj) {
  // Comentario: Renderiza resultados como tarjeta con soporte LaTeX (MathJax)
  let title = "Resultado";
  let exprHtml = "";
  let numericHtml = "";
  if (obj && typeof obj === "object") {
    // Preferir campos LaTeX específicos cuando estén disponibles
    const latexField = obj.resultado_latex || obj.integral_latex || obj.double_integral_latex || obj.inner_integral_latex || obj.result_latex;
    if (typeof latexField === "string" && latexField.trim().length) {
      exprHtml = `<p class="math-expression">${ensureBlockLatex(latexField)}</p>`;
    } else if (typeof obj.result === "string") {
      const texExpr = obj.result.replace(/exp\s*\(([^)]+)\)/gi, "e^{$1}");
      exprHtml = `<p class="math-expression">${ensureBlockLatex(texExpr)}</p>`;
    }
    if (typeof obj.value === "number") {
      numericHtml = `<p class=\"math-expression\">$$\\text{Valor numérico} = ${obj.value.toFixed(3)}$$</p>`;
    }
  }
  if (!exprHtml && !numericHtml) {
    exprHtml = `<p>⚠️ No se pudo mostrar un resultado formateado. Revisa la entrada o intenta otra operación.</p>`;
  }
  const html = `
    <div class="result-card">
      <h3>${title}:</h3>
      ${exprHtml}
      ${numericHtml}
    </div>
  `;
  updateMathContainer('results', html);
}

// =====================================
// Análisis de Dominio, Rango y Límite
// =====================================
async function analyzeDomainRange() {
  const expr = ensureExpression();
  if (!expr) return;

  // Recoger punto para límite si está disponible
  const x0s = normalizeNumericForBackend(x0Input?.value || "");
  const y0s = normalizeNumericForBackend(y0Input?.value || "");
  const hasPoint = x0s && y0s && x0s.trim() !== "" && y0s.trim() !== "";

  const payload = { expression: normalizeExpressionForBackend(expr) };
  if (hasPoint) { payload.x0 = x0s; payload.y0 = y0s; }

  try {
    const data = await postJSON("/analyze_domain", payload);
    const domainText = typeof data?.domain_conditions === "string" ? data.domain_conditions : "";
    const rangeEst = Array.isArray(data?.range_estimated) ? data.range_estimated : null;
    const limitVal = typeof data?.limit_value === "string" ? data.limit_value : null;

    // Tarjeta de resultados con dominio, rango y límite
    const texExpr = (() => { try { const n = math.parse(normalizeExpressionForLocal(expr)); return n.toTex({ parenthesis: 'auto', implicit: 'hide' }); } catch { return expr.replace(/\*\*/g,'^'); } })();
    resultsBox.innerHTML = `
      <div class="result-card result-card--domain animate-fade">
        <h3>📋 Análisis de Dominio y Rango</h3>
        <p class="math-expression">Función: \\( f(x,y) = ${sanitizeLatex(texExpr)} \\)</p>
        <p><b>Dominio:</b> ${domainText ? domainText : 'No se detectaron restricciones adicionales.'}</p>
        ${rangeEst ? `<p><b>Rango (aprox.):</b> [${Number(rangeEst[0]).toFixed(6)}, ${Number(rangeEst[1]).toFixed(6)}]</p>` : `<p style="color:#b75a00">No se pudo estimar el rango.</p>`}
        ${hasPoint ? `<p><b>Límite en \((x_0,y_0)\):</b> ${limitVal === 'undefined' ? '⚠️ El límite no existe' : (limitVal === 'infinity' || limitVal === '-infinity') ? `⚠️ Diverge (${limitVal})` : `\( ${limitVal} \)`}</p>` : ''}
      </div>
      <div class="summary-card animate-fade">
        <div class="summary-title">Interpretación</div>
        <p>El dominio son los pares \((x,y)\) donde \(f(x,y)\) está bien definida. El rango son los valores que toma \(f\) sobre ese dominio. El límite describe el comportamiento de \(f\) al acercarse a un punto.</p>
      </div>
    `;

    // Explicación educativa con MathJax
    stepsBox.innerHTML = `
      <div class="result-card explanation-box animate-fade">
        <h3>🧩 Proceso paso a paso</h3>
        <ol>
          <li>1️⃣ Se identifica la función \( f(x,y) \).</li>
          <li>2️⃣ Se analizan las condiciones de existencia (dominio): divisiones por cero, argumentos de log positivos y raíces cuadradas con radicando no negativo.</li>
          <li>3️⃣ Se determina el dominio permitido.</li>
          <li>4️⃣ Se evalúan los valores extremos de \( f(x,y) \) en una cuadrícula para estimar el rango.</li>
          <li>5️⃣ Se calcula el límite en el punto especificado (si se ingresó).</li>
        </ol>
        ${typeof data?.explanation === 'string' ? `<p>${data.explanation}</p>` : ''}
      </div>
    `;

    // Re-render KaTeX en resultados y pasos
    renderMathAll([resultsBox, stepsBox]);

    // Visualización 2D del dominio: sombrear región válida
    await plotDomain2D(expr);
    // Superficie 3D restringida al dominio (valores no definidos como null)
    await draw3DGraph(expr);
  } catch (err) {
    showError(err.message);
  }
}

// Dibuja el dominio en 2D sombreando en azul la región válida
async function plotDomain2D(expression) {
  try {
    if (!window.Plotly) throw new Error("Plotly no está disponible");
    const targetDiv = document.getElementById("domain-2d");
    const explBox = document.getElementById("domain-2d-expl");
    if (!targetDiv) return;
    const range = { min: -10, max: 10 };
    const xVals = createRange(range.min, range.max, 121);
    const yVals = createRange(range.min, range.max, 121);
    const node = math.compile(normalizeExpressionForLocal(expression));
    const mask = [];
    for (let i = 0; i < xVals.length; i++) {
      const row = [];
      for (let j = 0; j < yVals.length; j++) {
        const x = xVals[i]; const y = yVals[j];
        try {
          const z = node.evaluate({ x, y });
          const ok = Number.isFinite(Number(z));
          row.push(ok ? 1 : null);
        } catch { row.push(null); }
      }
      mask.push(row);
    }

    const heatTrace = {
      type: 'heatmap',
      x: xVals,
      y: yVals,
      z: mask,
      colorscale: 'Blues',
      showscale: false,
      opacity: 0.7,
    };
    const layout = { title: '📊 Dominio de f(x,y)', xaxis: { title: 'x' }, yaxis: { title: 'y' }, margin: { l: 40, r: 10, t: 40, b: 40 } };
    window.Plotly.newPlot(targetDiv, [heatTrace], layout, { responsive: true });
    if (explBox) {
      explBox.innerHTML = `<p>La región azul indica los pares \((x,y)\) donde \( f(x,y) \) está definida. Las zonas vacías corresponden a restricciones del dominio.</p>`;
      renderMathAll([explBox]);
    }
  } catch (e) {
    console.warn('No se pudo graficar el dominio 2D:', e);
  }
}
// Helper para mostrar errores
function showError(message) {
  // Comentario: Si es un error de conexión backend, mostrar aviso discreto y no tocar resultados
  const msg = String(message || "");
  if (/Error de red|No se pudo conectar|conexión fallida|Failed to fetch/i.test(msg)) {
    const explBox = document.getElementById("plot3d-expl") || graphExplBox;
    if (explBox) {
      explBox.innerHTML = `<p style="color:#b75a00">⚠️ Backend no disponible; se usa cálculo local para la gráfica.</p>`;
    } else {
      console.warn("Backend no disponible; modo local activo.");
    }
    return;
  }
  // Comentario: Muestra errores en una tarjeta visual, sin JSON crudo
  resultsBox.innerHTML = `
    <div class="result-card">
      <h3>Error:</h3>
      <p>${msg}</p>
    </div>
  `;
  if (stepsBox) stepsBox.innerHTML = "";
}

// Helper para validar que la función no esté vacía
function ensureExpression() {
  const expr = (expressionInput.value || "").trim();
  if (!expr) {
    showError("Por favor ingresa una función f(x,y).");
    return null;
  }
  return expr;
}

// Normaliza la expresión para el backend (SymPy)
// Convierte operadores y nombres comunes en español a equivalentes aceptados
function normalizeExpressionForBackend(expr) {
  let out = (expr || "").trim();
  // Potencias: ^ -> ** (SymPy usa **)
  out = out.replace(/\^/g, "**");
  // Logaritmo natural: ln -> log
  out = out.replace(/\bln\b/gi, "log");
  // Seno en español: sen -> sin
  out = out.replace(/\bsen\b/gi, "sin");
  // Símbolos especiales y Unicode: convertir a tokens aceptados
  out = out.replace(/π/g, "pi");
  out = out.replace(/≤/g, "<=");
  out = out.replace(/≥/g, ">=");
  // Remueve notación visual que no es parseable por el backend
  out = out.replace(/[∫∂∇→≈]/g, "");
  // Constante de Euler: 'e' aislada -> 'E' (SymPy)
  out = out.replace(/\be\b/g, "E");
  // Asegura minúsculas para funciones comunes
  out = out.replace(/\bSIN\b|\bCos\b|\bTan\b|\bEXP\b|\bLOG\b|\bSQRT\b/g, (m) => m.toLowerCase());
  return out;
}

// Normaliza valores numéricos simbólicos para el backend (SymPy)
// Comentario: Convierte entradas como "π/4", "e/2", "1,5" y potencias con '^'
// en formatos aceptados por el backend: "pi/4", "E/2", "1.5" y "**".
function normalizeNumericForBackend(value) {
  let out = (value || "").toString().trim();
  if (!out) return "";
  // Reemplazar coma decimal por punto
  out = out.replace(/,(?=\d)/g, ".");
  // Potencia: ^ -> **
  out = out.replace(/\^/g, "**");
  // Símbolo pi
  out = out.replace(/π/gi, "pi");
  // Euler aislada a E (evita reemplazar parte de variables)
  out = out.replace(/\be\b/g, "E");
  // Espacios redundantes
  out = out.replace(/\s+/g, "");
  return out;
}

// Helper para hacer POST seguro al backend
async function postJSON(path, payload) {
  // Envía POST con fallback: intenta mismo origen (si no es file://) y luego BASE_URL
  const targets = [];
  // Prioriza siempre el backend real definido por BASE_URL
  targets.push(`${BASE_URL}${path}`);
  // Luego intenta mismo origen si no es file:// (por si existe proxy)
  if (window.location?.protocol !== "file:") {
    targets.push(path);
  }

  let lastErr = null;
  for (const url of targets) {
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      let data;
      try {
        data = await res.json();
      } catch (parseErr) {
        throw new Error(`Respuesta no válida del backend (HTTP ${res.status})`);
      }
      if (!res.ok || data.error) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    } catch (err) {
      lastErr = err;
    }
  }
  // Mensaje claro para el usuario cuando no se pudo conectar
  const base = BASE_URL || window.location.origin || "http://127.0.0.1:5000";
  throw new Error(`Error de red: ${lastErr?.message || "conexión fallida"}. Verifica que el backend esté corriendo en ${base}`);
}

// Verifica la conexión con el backend sin interrumpir la UI
async function pingBackend() {
  try {
    const targets = [];
    // Primero intenta el backend real
    targets.push(`${BASE_URL}/ping`);
    // Luego mismo origen (si existe proxy)
    if (window.location?.protocol !== "file:") targets.push(`/ping`);
    let ok = false;
    for (const url of targets) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Ping HTTP ${res.status}`);
        const data = await res.json();
        console.log("Backend ping:", data);
        ok = true;
        break;
      } catch (_) {}
    }
    // Guarda estado global para que otros flujos sepan si hay backend
    window.BACKEND_AVAILABLE = !!ok;
    if (!ok) {
      // Comentario: Aviso no intrusivo; no limpiamos resultados ni pasos
      console.warn("Backend no disponible; se usará cálculo local.");
      const explBox = document.getElementById("plot3d-expl") || graphExplBox;
      if (explBox) {
        explBox.innerHTML = `<p style="color:#b75a00">⚠️ Backend no disponible; se usa cálculo local para la gráfica.</p>`;
      }
    }
  } catch (e) {
    // Comentario: En caso de excepción inesperada, mantener silencio en UI
    console.warn("Error ping backend:", e);
    window.BACKEND_AVAILABLE = false;
  }
}

// Función para generar rangos uniformes
function createRange(min, max, steps) {
  // Crea un arreglo de valores equiespaciados entre min y max
  const out = [];
  const step = (max - min) / (steps - 1);
  for (let i = 0; i < steps; i++) out.push(min + i * step);
  return out;
}

// Normaliza la expresión para evaluación local (Math.js)
function normalizeExpressionForLocal(expr) {
  let out = (expr || "").trim();
  // Potencias: ** -> ^ para Math.js
  out = out.replace(/\*\*/g, "^");
  // Logaritmo natural: ln -> log
  out = out.replace(/\bln\b/gi, "log");
  // Seno en español: sen -> sin
  out = out.replace(/\bsen\b/gi, "sin");
  // Unicode y símbolos especiales para evaluación local
  out = out.replace(/π/g, "pi");
  // Ajuste de constante: 'E' -> 'e' para Math.js
  out = out.replace(/\bE\b/g, "e");
  // Remueve notación visual no evaluable
  out = out.replace(/[∫∂∇→≈]/g, "");
  return out;
}

// Analiza la expresión para generar explicaciones contextuales de la gráfica en el frontend
function analyzeExpressionType(expr) {
  const lowered = (expr || "").toLowerCase();
  const cats = [];
  if (/(sin|cos|tan|csc|sec|cot|sinh|cosh|tanh|csch|sech|coth)\s*\(/.test(lowered)) cats.push('trigonométrica');
  if (/\blog\s*\(/.test(lowered)) cats.push('logarítmica');
  if (/\bexp\s*\(/.test(lowered)) cats.push('exponencial');
  if (/\bsqrt\s*\(/.test(lowered) || /(\*\*|\^)\s*\d+\s*\/\s*\d+/.test(lowered)) cats.push('raíz');
  if (/\babs\s*\(/.test(lowered)) cats.push('valor absoluto');
  const tokens = (lowered.match(/[a-z_]+/g) || []).filter(t => !['x','y'].includes(t));
  if (tokens.length === 0) cats.push('polinómica');
  const kind = cats.length === 0 ? 'general' : (cats.length === 1 ? cats[0] : 'mixta (' + cats.join(', ') + ')');
  const brief = `La superficie corresponde a una función ${kind}. Observa picos y valles donde la magnitud de f varía; zonas planas indican cambios suaves.`;
  const parts = [];
  if (cats.includes('polinómica')) parts.push('En funciones polinómicas, la curvatura es regular; términos cuadráticos producen paraboloides y los de mayor grado intensifican el crecimiento.');
  if (cats.includes('trigonométrica')) parts.push('Las funciones trigonométricas generan ondulaciones periódicas; hay crestas y valles alternados según las frecuencias en x e y.');
  if (cats.includes('logarítmica')) parts.push('El logaritmo crece lentamente y solo está definido donde su argumento es positivo; cerca del borde tiende a −∞.');
  if (cats.includes('exponencial')) parts.push('La exponencial crece muy rápido para valores grandes de x e y, creando zonas elevadas pronunciadas.');
  if (cats.includes('raíz')) parts.push('Las raíces cuadradas requieren argumento no negativo; aparece un borde donde el argumento se anula y la superficie emerge suavemente.');
  if (cats.includes('valor absoluto')) parts.push('El valor absoluto introduce aristas donde el argumento cambia de signo, generando transiciones angulares en la superficie.');
  const detailed = (parts.join(' ') || 'La gráfica z=f(x,y) muestra cómo la función se distribuye sobre el plano; el gradiente indica dirección de máximo incremento y las integrales dobles calculan volúmenes bajo la superficie.');
  return { kind, brief, detailed };
}

// Evalúa una cuadrícula utilizando Math.js localmente (sin backend)
function evaluateGridLocal(expression, xVals, yVals) {
  // Usa math.js para evaluar f(x,y) sobre una malla de puntos.
  const exprForMath = normalizeExpressionForLocal(expression);
  let compiled = null;
  let useNaive = false;
  try {
    if (typeof math === "undefined" || !math?.compile) throw new Error("math.js no está disponible");
    compiled = math.compile(exprForMath);
  } catch (e) {
    // Fallback: evaluador nativo básico con Math.*
    useNaive = true;
  }

  // Prepara expresión para evaluador nativo si es necesario
  let exprForJS = String(expression || "");
  if (useNaive) {
    // Potencias: ^ -> ** y asegura ** permanece
    exprForJS = exprForJS.replace(/\^/g, "**");
    // Normalizaciones de nombres
    exprForJS = exprForJS.replace(/\bln\b/gi, "log");
    exprForJS = exprForJS.replace(/\bsen\b/gi, "sin");
    // Constantes
    exprForJS = exprForJS.replace(/π/gi, "pi");
    exprForJS = exprForJS.replace(/\bpi\b/gi, "Math.PI");
    exprForJS = exprForJS.replace(/\bE\b/g, "Math.E");
    exprForJS = exprForJS.replace(/\be\b/g, "Math.E");
    // Funciones base a Math.*
    exprForJS = exprForJS.replace(/\blog\s*\(/gi, "Math.log(");
    exprForJS = exprForJS.replace(/\bsqrt\s*\(/gi, "Math.sqrt(");
    exprForJS = exprForJS.replace(/\bexp\s*\(/gi, "Math.exp(");
    exprForJS = exprForJS.replace(/\babs\s*\(/gi, "Math.abs(");
    exprForJS = exprForJS.replace(/\bsin\s*\(/gi, "Math.sin(");
    exprForJS = exprForJS.replace(/\bcos\s*\(/gi, "Math.cos(");
    exprForJS = exprForJS.replace(/\btan\s*\(/gi, "Math.tan(");
    exprForJS = exprForJS.replace(/\basin\s*\(/gi, "Math.asin(");
    exprForJS = exprForJS.replace(/\bacos\s*\(/gi, "Math.acos(");
    exprForJS = exprForJS.replace(/\batan\s*\(/gi, "Math.atan(");
    // Hiperbólicas
    exprForJS = exprForJS.replace(/\bsinh\s*\(/gi, "Math.sinh(");
    exprForJS = exprForJS.replace(/\bcosh\s*\(/gi, "Math.cosh(");
    exprForJS = exprForJS.replace(/\btanh\s*\(/gi, "Math.tanh(");
    // Recíprocas (csc, sec, cot) y sus hiperbólicas
    exprForJS = exprForJS.replace(/\bcsc\s*\(/gi, "(1/Math.sin(");
    exprForJS = exprForJS.replace(/\bsec\s*\(/gi, "(1/Math.cos(");
    exprForJS = exprForJS.replace(/\bcot\s*\(/gi, "(1/Math.tan(");
    exprForJS = exprForJS.replace(/\bcsch\s*\(/gi, "(1/Math.sinh(");
    exprForJS = exprForJS.replace(/\bsech\s*\(/gi, "(1/Math.cosh(");
    exprForJS = exprForJS.replace(/\bcoth\s*\(/gi, "(1/Math.tanh(");
    // Cierra paréntesis extra agregados por las recíprocas cuando se evalúa
    // Nota: el cierre lo maneja el propio usuario al escribir la función (ej: csc(x)) → (1/Math.sin(x))
  }

  const z = Array(yVals.length)
    .fill(0)
    .map(() => Array(xVals.length).fill(0));

  for (let j = 0; j < yVals.length; j++) {
    for (let i = 0; i < xVals.length; i++) {
      const scope = { x: xVals[i], y: yVals[j] };
      try {
        let val;
        if (!useNaive) {
          val = compiled.evaluate(scope);
        } else {
          // Evaluación nativa segura: expone solo x,y y Math
          // eslint-disable-next-line no-new-func
          const f = new Function("x", "y", `return ${exprForJS}`);
          val = f(scope.x, scope.y);
        }
        z[j][i] = Number(val);
        if (!Number.isFinite(z[j][i])) z[j][i] = NaN;
      } catch (e) {
        // En caso de error de evaluación, marcamos como NaN
        z[j][i] = NaN;
      }
    }
  }
  return z;
}

// Evalúa f(x,y) en un punto de forma local (usa Math.js si está, si no, evaluador nativo)
function evaluateLocalAtPoint(expression, x, y) {
  try {
    if (typeof math !== "undefined" && math?.compile) {
      const node = math.compile(normalizeExpressionForLocal(expression));
      const val = node.evaluate({ x, y });
      const num = Number(val);
      return Number.isFinite(num) ? num : NaN;
    }
  } catch (_) {}
  // Fallback nativo
  try {
    let exprJS = String(expression || "");
    exprJS = exprJS.replace(/\^/g, "**");
    exprJS = exprJS.replace(/\bln\b/gi, "log");
    exprJS = exprJS.replace(/\bsen\b/gi, "sin");
    exprJS = exprJS.replace(/π/gi, "pi");
    exprJS = exprJS.replace(/\bpi\b/gi, "Math.PI");
    exprJS = exprJS.replace(/\bE\b/g, "Math.E");
    exprJS = exprJS.replace(/\be\b/g, "Math.E");
    exprJS = exprJS.replace(/\blog\s*\(/gi, "Math.log(");
    exprJS = exprJS.replace(/\bsqrt\s*\(/gi, "Math.sqrt(");
    exprJS = exprJS.replace(/\bexp\s*\(/gi, "Math.exp(");
    exprJS = exprJS.replace(/\babs\s*\(/gi, "Math.abs(");
    exprJS = exprJS.replace(/\bsin\s*\(/gi, "Math.sin(");
    exprJS = exprJS.replace(/\bcos\s*\(/gi, "Math.cos(");
    exprJS = exprJS.replace(/\btan\s*\(/gi, "Math.tan(");
    exprJS = exprJS.replace(/\basin\s*\(/gi, "Math.asin(");
    exprJS = exprJS.replace(/\bacos\s*\(/gi, "Math.acos(");
    exprJS = exprJS.replace(/\batan\s*\(/gi, "Math.atan(");
    exprJS = exprJS.replace(/\bsinh\s*\(/gi, "Math.sinh(");
    exprJS = exprJS.replace(/\bcosh\s*\(/gi, "Math.cosh(");
    exprJS = exprJS.replace(/\btanh\s*\(/gi, "Math.tanh(");
    exprJS = exprJS.replace(/\bcsc\s*\(/gi, "(1/Math.sin(");
    exprJS = exprJS.replace(/\bsec\s*\(/gi, "(1/Math.cos(");
    exprJS = exprJS.replace(/\bcot\s*\(/gi, "(1/Math.tan(");
    exprJS = exprJS.replace(/\bcsch\s*\(/gi, "(1/Math.sinh(");
    exprJS = exprJS.replace(/\bsech\s*\(/gi, "(1/Math.cosh(");
    exprJS = exprJS.replace(/\bcoth\s*\(/gi, "(1/Math.tanh(");
    // eslint-disable-next-line no-new-func
    const f = new Function("x", "y", `return ${exprJS}`);
    const out = Number(f(x, y));
    return Number.isFinite(out) ? out : NaN;
  } catch (_) {
    return NaN;
  }
}

// Normaliza números/expresiones cortas para evaluación local (Math.js o JS)
function normalizeNumericForLocal(value) {
  let out = (value || "").trim();
  out = out.replace(/π/g, "pi");
  out = out.replace(/\bE\b/g, "e");
  out = out.replace(/[∫∂∇→≈]/g, "");
  return out;
}

// Convierte textos como "pi/2" o "3.5" a número usando Math.js o JS
function parseNumberFlexible(value) {
  const s = normalizeNumericForLocal(value || "");
  if (!s) return NaN;
  try {
    if (typeof math !== "undefined" && math?.evaluate) {
      const n = Number(math.evaluate(s));
      if (Number.isFinite(n)) return n;
    }
  } catch (_) {}
  try {
    let js = s;
    js = js.replace(/\^/g, "**");
    js = js.replace(/\bpi\b/gi, "Math.PI");
    js = js.replace(/\be\b/gi, "Math.E");
    // eslint-disable-next-line no-new-func
    const f = new Function(`return (${js})`);
    const n = Number(f());
    return Number.isFinite(n) ? n : NaN;
  } catch (_) {
    return NaN;
  }
}

// Derivadas parciales simbólicas (si Math.js está disponible)
function trySymbolicPartials(expression) {
  try {
    if (typeof math === "undefined" || !math?.derivative) return null;
    const exprLocal = normalizeExpressionForLocal(expression);
    const node = math.parse(exprLocal);
    const fx = math.derivative(node, 'x');
    const fy = math.derivative(node, 'y');
    const fxTex = fx.toTex({ parenthesis: 'auto', implicit: 'hide' });
    const fyTex = fy.toTex({ parenthesis: 'auto', implicit: 'hide' });
    return { fxTex, fyTex };
  } catch (_) {
    return null;
  }
}

// Derivadas parciales numéricas en (x,y) por diferencias finitas
function numericPartialsAt(expression, x, y, h = 1e-4) {
  const f = (xi, yi) => evaluateLocalAtPoint(expression, xi, yi);
  const fx = (f(x + h, y) - f(x - h, y)) / (2 * h);
  const fy = (f(x, y + h) - f(x, y - h)) / (2 * h);
  return { fx, fy };
}

// Hessiano numérico y búsqueda local de puntos críticos
function numericHessianAt(expression, x, y, h = 1e-4) {
  // Comentario: Aproxima fxx, fyy y fxy por diferencias finitas centrales
  const f = (xx, yy) => evaluateLocalAtPoint(expression, xx, yy);
  const fxx = (f(x + h, y) - 2 * f(x, y) + f(x - h, y)) / (h * h);
  const fyy = (f(x, y + h) - 2 * f(x, y) + f(x, y - h)) / (h * h);
  const fxy = (f(x + h, y + h) - f(x + h, y - h) - f(x - h, y + h) + f(x - h, y - h)) / (4 * h * h);
  return { fxx, fyy, fxy };
}

function findCriticalPointsLocal(expression) {
  // Comentario: Busca ∇f≈0 en rejilla y refina con pasos tipo Newton usando Hessiano
  const range = pickSafeRangeForExpr(expression);
  const xs = createRange(range.min, range.max, 21);
  const ys = createRange(range.min, range.max, 21);
  const threshold = 1e-2;
  const cand = [];
  for (const xv of xs) {
    for (const yv of ys) {
      const { fx, fy } = numericPartialsAt(expression, xv, yv);
      const g = Math.hypot(fx, fy);
      if (Number.isFinite(g) && g < threshold) cand.push([xv, yv]);
    }
  }
  const uniq = [];
  const distTol = 1e-2;
  const near = (ax, ay) => uniq.some(([ux, uy]) => Math.hypot(ax - ux, ay - uy) < distTol);
  for (const [cx, cy] of cand) {
    let px = cx, py = cy;
    for (let it = 0; it < 6; it++) {
      const { fx, fy } = numericPartialsAt(expression, px, py);
      const { fxx, fyy, fxy } = numericHessianAt(expression, px, py);
      const detH = fxx * fyy - fxy * fxy;
      if (!Number.isFinite(detH) || Math.abs(detH) < 1e-12) break;
      const inv00 = fyy / detH, inv01 = -fxy / detH, inv10 = -fxy / detH, inv11 = fxx / detH;
      const dx = inv00 * fx + inv01 * fy;
      const dy = inv10 * fx + inv11 * fy;
      px -= dx; py -= dy;
      if (Math.hypot(dx, dy) < 1e-6) break;
    }
    if (Number.isFinite(px) && Number.isFinite(py) && !near(px, py)) uniq.push([px, py]);
  }
  const results = [];
  for (const [px, py] of uniq) {
    const { fxx, fyy, fxy } = numericHessianAt(expression, px, py);
    const D = fxx * fyy - fxy * fxy;
    const fval = evaluateLocalAtPoint(expression, px, py);
    let classification = "Punto de silla", color = "red";
    if (D > 1e-6 && fxx > 0) { classification = "Mínimo local"; color = "green"; }
    else if (D > 1e-6 && fxx < 0) { classification = "Máximo local"; color = "blue"; }
    else if (Math.abs(D) <= 1e-6) { classification = "Prueba inconclusa"; color = "orange"; }
    results.push({ x: px, y: py, f: fval, classification, color, determinant: D, fxx, fyy, fxy });
  }
  return results;
}

// Integral doble definida por suma de Riemann sobre rejilla rectangular
function numericDoubleIntegralRect(expression, x0, x1, y0, y1, nx = 60, ny = 60) {
  const dx = (x1 - x0) / nx;
  const dy = (y1 - y0) / ny;
  let sum = 0;
  for (let j = 0; j < ny; j++) {
    const y = y0 + (j + 0.5) * dy;
    for (let i = 0; i < nx; i++) {
      const x = x0 + (i + 0.5) * dx;
      const val = evaluateLocalAtPoint(expression, x, y);
      if (Number.isFinite(val)) sum += val * dx * dy;
    }
  }
  return sum;
}

// Selecciona un rango seguro según la presencia de funciones con dominios delicados
function pickSafeRangeForExpr(expression) {
  // Comentario: Si hay tangentes, reducimos el rango para evitar asíntotas cercanas
  // log y sqrt requieren argumentos positivos; mantener un rango moderado ayuda
  const lowered = (expression || "").toLowerCase();
  let limit = 5; // valor por defecto
  // Asegurar que no coincida con tanh
  if (/\btan\s*\(/.test(lowered)) limit = Math.min(limit, 1.2);
  if (/\blog\s*\(/.test(lowered)) limit = Math.min(limit, 5);
  if (/\bsqrt\s*\(/.test(lowered)) limit = Math.min(limit, 4);
  return { min: -limit, max: limit };
}

// Sanitiza la malla Z convirtiendo NaN/±Infinity en null para compatibilidad con Plotly
function sanitizeZGrid(zGrid) {
  // Comentario: Recorrer la grilla y reemplazar valores no definidos por null
  return zGrid.map(row => row.map(v => (Number.isFinite(v) ? v : null)));
}

// Dibuja la gráfica 3D global z = f(x,y) usando Plotly.js
// Comentario: Ajusta rango automáticamente y marca el punto evaluado si se proporciona
async function draw3DGraph(func, x0 = null, y0 = null, fValue = null) {
  try {
    if (!window.Plotly) throw new Error("Plotly no está disponible");
    const expression = (func || "").trim();
    if (!expression) throw new Error("No hay función para graficar.");

    // Contenedores de la gráfica y explicación
    const targetDiv = graphDiv;
    const explBox = graphExplBox;
    if (!targetDiv) throw new Error("No se encontró contenedor de gráfica.");

    // Selección de rango seguro según la expresión
    const range = pickSafeRangeForExpr(expression);
    const xVals = createRange(range.min, range.max, 41);
    const yVals = createRange(range.min, range.max, 41);

    // Evaluación local y sanitización
    const zRaw = evaluateGridLocal(expression, xVals, yVals);
    const z = sanitizeZGrid(zRaw);

    // Trazo de superficie (azul semitransparente)
    const surfaceTrace = {
      type: "surface",
      x: xVals,
      y: yVals,
      z: z,
      colorscale: "Blues",
      opacity: 0.85,
    };

    // Punto evaluado (si hay coordenadas)
    let pointTrace = null;
    try {
      let x0Num = null, y0Num = null, z0Num = null;
      if (x0 !== null && y0 !== null) {
        // Comentario: Intentar convertir a número usando Math.js por si contiene pi o expresiones
        const x0s = normalizeNumericForBackend(String(x0));
        const y0s = normalizeNumericForBackend(String(y0));
        try { x0Num = Number(math.evaluate(x0s)); } catch { x0Num = Number(x0); }
        try { y0Num = Number(math.evaluate(y0s)); } catch { y0Num = Number(y0); }
        if (Number.isFinite(x0Num) && Number.isFinite(y0Num)) {
          if (fValue !== null && Number.isFinite(Number(fValue))) {
            z0Num = Number(fValue);
          } else {
            const node = math.compile(normalizeExpressionForLocal(expression));
            const z0 = node.evaluate({ x: x0Num, y: y0Num });
            z0Num = Number.isFinite(Number(z0)) ? Number(z0) : null;
          }
          pointTrace = {
            type: "scatter3d",
            mode: "markers+text",
            x: [x0Num],
            y: [y0Num],
            z: [z0Num],
            marker: { color: "red", size: 6 },
            text: [
              Number.isFinite(x0Num) && Number.isFinite(y0Num) && Number.isFinite(z0Num)
                ? `(${x0Num.toFixed(3)}, ${y0Num.toFixed(3)}, ${z0Num.toFixed(3)})`
                : ""
            ],
            textposition: "top center",
            name: "Punto evaluado",
          };
        }
      }
    } catch (_) {
      // Comentario: Si falla el cálculo del punto, se omite el marcador
    }

    // Puntos críticos aproximados (∇f ≈ 0)
    let criticalTrace = null;
    try {
      const crits = findCriticalPointsLocal(expression);
      if (Array.isArray(crits) && crits.length) {
        const cx = [], cy = [], cz = [], colors = [], labels = [];
        const fNode = math.compile(normalizeExpressionForLocal(expression));
        for (const c of crits) {
          const zx = Number(c.x), zy = Number(c.y);
          let zz = Number(c.f);
          if (!Number.isFinite(zz)) {
            try { zz = Number(fNode.evaluate({ x: zx, y: zy })); } catch { zz = NaN; }
          }
          if (!Number.isFinite(zx) || !Number.isFinite(zy) || !Number.isFinite(zz)) continue;
          cx.push(zx); cy.push(zy); cz.push(zz);
          colors.push(c.color || 'red');
          labels.push(`${c.classification}: (${zx.toFixed(3)}, ${zy.toFixed(3)}, ${zz.toFixed(3)})`);
        }
        if (cx.length) {
          criticalTrace = {
            type: 'scatter3d', mode: 'markers+text', x: cx, y: cy, z: cz,
            marker: { color: colors, size: 6 }, text: labels, textposition: 'top center', name: 'Puntos críticos'
          };
        }
      }
    } catch (_) { /* opcional */ }

    const data = criticalTrace ? (pointTrace ? [surfaceTrace, pointTrace, criticalTrace] : [surfaceTrace, criticalTrace]) : (pointTrace ? [surfaceTrace, pointTrace] : [surfaceTrace]);
    const layout = {
      title: "Superficie de f(x,y)",
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 30 },
      scene: {
        xaxis: { title: "x" },
        yaxis: { title: "y" },
        zaxis: { title: "f(x,y)" },
      },
    };

    // Renderizar gráfica; si hay nulls, Plotly ignora sin romper
    window.Plotly.newPlot(targetDiv, data, layout, { responsive: true });

    // Explicación contextual debajo de la gráfica
    if (explBox) {
      const tex = (() => {
        try {
          const node = math.parse(normalizeExpressionForLocal(expression));
          return node.toTex({ parenthesis: 'auto', implicit: 'hide' });
        } catch (e) {
          return normalizeExpressionForLocal(expression).replace(/\*\*/g, '^');
        }
      })();
      const brief = analyzeExpressionType(expression).brief;
      explBox.innerHTML = `
        <h4>💬 Explicación de la gráfica</h4>
        <p>La superficie representa:</p>
        <div class="math-expression">${ensureBlockLatex(`z = f(x,y) = ${tex}`)}</div>
        <p>sobre el plano <span class="math-expression">\\((x,y)\\)</span>.</p>
        <ul>
          <li>Eje <span class="math-expression">\\(x\\)</span>: valores de la variable <span class="math-expression">\\(x\\)</span></li>
          <li>Eje <span class="math-expression">\\(y\\)</span>: valores de la variable <span class="math-expression">\\(y\\)</span></li>
          <li>Eje <span class="math-expression">\\(z\\)</span>: valor de la función <span class="math-expression">\\(f(x,y)\\)</span></li>
        </ul>
        <p>${brief}</p>
        <div class="math-expression">${ensureBlockLatex(`\\nabla f \\approx 0`)}</div>
      `;
      // Migrado a KaTeX
      renderMathAll([explBox]);
    }
  } catch (err) {
    // Comentario: Mostrar advertencia sin borrar la última gráfica válida
    if (graphExplBox) {
      graphExplBox.innerHTML = `<p style="color:#b75a00">⚠️ No se pudo graficar la función en este dominio. Intenta cambiar los límites o el tipo de función.</p>`;
    }
    console.warn("Fallo al graficar:", err);
  }
}

// Extracción y trazado de la curva de restricción g(x,y)=0 sobre z=f(x,y)
// Comentario: Muestra la curva en rojo sobre la superficie, aproximada con búsqueda por bisección
async function drawConstraintCurveOnSurface(funcExpr, constraintExpr) {
  try {
    if (!window.Plotly) return;
    const func = (funcExpr || "").trim();
    const constr = (constraintExpr || "").trim();
    if (!func || !constr) return;

    const range = pickSafeRangeForExpr(func);
    const xVals = createRange(range.min, range.max, 41);
    const yVals = createRange(range.min, range.max, 81);

    const gNode = math.compile(normalizeExpressionForLocal(constr));
    const fNode = math.compile(normalizeExpressionForLocal(func));

    const xCurve = [];
    const yCurve = [];
    const zCurve = [];

    const evalG = (x, y) => {
      try { return Number(gNode.evaluate({ x, y })); } catch { return NaN; }
    };
    const evalF = (x, y) => {
      try { return Number(fNode.evaluate({ x, y })); } catch { return NaN; }
    };

    // Búsqueda de raíces en y para cada x con detección de cambio de signo
    for (let i = 0; i < xVals.length; i++) {
      const x = xVals[i];
      let lastVal = evalG(x, yVals[0]);
      for (let j = 0; j < yVals.length - 1; j++) {
        const y1 = yVals[j];
        const y2 = yVals[j + 1];
        const v1 = (j === 0) ? lastVal : evalG(x, y1);
        const v2 = evalG(x, y2);

        if (!Number.isFinite(v1) || !Number.isFinite(v2)) {
          lastVal = v2;
          continue;
        }
        if (Math.abs(v1) < 1e-6) {
          const z = evalF(x, y1);
          if (Number.isFinite(z)) { xCurve.push(x); yCurve.push(y1); zCurve.push(z); }
        }
        if (v1 === 0 || v2 === 0 || v1 * v2 < 0) {
          // Bisección para refinar raíz en [y1, y2]
          let a = y1, b = y2;
          let fa = v1, fb = v2;
          let yr = null;
          for (let k = 0; k < 24; k++) {
            const m = 0.5 * (a + b);
            const fm = evalG(x, m);
            if (!Number.isFinite(fm)) break;
            if (Math.abs(fm) < 1e-10) { yr = m; break; }
            if (fa * fm <= 0) { b = m; fb = fm; } else { a = m; fa = fm; }
            yr = m;
          }
          if (yr !== null && Number.isFinite(yr)) {
            const z = evalF(x, yr);
            if (Number.isFinite(z)) { xCurve.push(x); yCurve.push(yr); zCurve.push(z); }
          }
        }
        lastVal = v2;
      }
    }

    if (!xCurve.length) return;

    const curveTrace = {
      type: "scatter3d",
      mode: "lines",
      x: xCurve,
      y: yCurve,
      z: zCurve,
      line: { color: "red", width: 4 },
      name: "Restricción g(x,y)=0",
    };

    // Agregar la traza a la gráfica existente
    if (graphDiv && graphDiv.data) {
      window.Plotly.addTraces(graphDiv, [curveTrace]);
    } else if (graphDiv) {
      // Si no hay gráfica previa, dibujar superficie primero
      await draw3DGraph(funcExpr);
      window.Plotly.addTraces(graphDiv, [curveTrace]);
    }
  } catch (e) {
    console.warn("No se pudo dibujar la curva de restricción:", e);
  }
}

// Fallback local: resolver condiciones de Lagrange sin backend
// Comentario: Busca puntos donde g(x,y)=0 y fx*gy - fy*gx = 0 (proporcionalidad de gradientes)
async function solveLagrangeLocal(fExpr, gExpr) {
  try {
    const fLocal = normalizeExpressionForLocal(fExpr);
    const gLocal = normalizeExpressionForLocal(gExpr);
    const fNode = math.parse(fLocal);
    const gNode = math.parse(gLocal);
    const fxNode = math.derivative(fNode, 'x');
    const fyNode = math.derivative(fNode, 'y');
    const gxNode = math.derivative(gNode, 'x');
    const gyNode = math.derivative(gNode, 'y');

    const evalF = (x,y) => {
      try { return Number(fNode.evaluate({x,y})); } catch { return NaN; }
    };
    const evalG = (x,y) => {
      try { return Number(gNode.evaluate({x,y})); } catch { return NaN; }
    };
    const evalC = (x,y) => {
      try {
        const fx = Number(fxNode.evaluate({x,y}));
        const fy = Number(fyNode.evaluate({x,y}));
        const gx = Number(gxNode.evaluate({x,y}));
        const gy = Number(gyNode.evaluate({x,y}));
        return fx*gy - fy*gx;
      } catch { return NaN; }
    };

    const range = pickSafeRangeForExpr(fExpr);
    const xs = createRange(range.min, range.max, 60);
    const ys = createRange(range.min, range.max, 60);

    // Muestrea la curva de restricción g=0 por bisección en segmentos de la grilla
    const curvePts = [];
    const refineOnSegment = (x1,y1,x2,y2, evalFun) => {
      let ax=x1, ay=y1, bx=x2, by=y2;
      let fa = evalFun(ax,ay);
      let fb = evalFun(bx,by);
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
      if (fa===0) return {x:ax,y:ay};
      if (fb===0) return {x:bx,y:by};
      if (fa*fb>0) return null;
      for (let it=0; it<22; it++) {
        const mx = 0.5*(ax+bx); const my = 0.5*(ay+by);
        const fm = evalFun(mx,my);
        if (!Number.isFinite(fm)) break;
        if (Math.abs(fm) < 1e-6) { ax=mx; ay=my; break; }
        if (fa*fm <= 0) { bx=mx; by=my; fb=fm; } else { ax=mx; ay=my; fa=fm; }
      }
      return {x:ax,y:ay};
    };
    for (let i=0;i<xs.length;i++){
      for (let j=0;j<ys.length-1;j++){
        const x=xs[i], y1=ys[j], y2=ys[j+1];
        const hint = refineOnSegment(x,y1,x,y2, evalG);
        if (hint) curvePts.push(hint);
      }
    }
    for (let j=0;j<ys.length;j++){
      for (let i=0;i<xs.length-1;i++){
        const y=ys[j], x1=xs[i], x2=xs[i+1];
        const hint = refineOnSegment(x1,y,x2,y, evalG);
        if (hint) curvePts.push(hint);
      }
    }
    if (!curvePts.length) return [];

    // Orden superficial para coherencia visual
    curvePts.sort((a,b)=> a.x===b.x ? a.y-b.y : a.x-b.x);

    // Buscar cambios de signo en C(x,y) sobre la curva y refinar el cero por bisección
    const candidates = [];
    const refineCOnSegment = (p,q) => {
      let ax=p.x, ay=p.y, bx=q.x, by=q.y;
      let fa = evalC(ax,ay);
      let fb = evalC(bx,by);
      if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
      if (Math.abs(fa) < 1e-8) return {x:ax,y:ay};
      if (fa*fb>0) return null;
      for (let it=0; it<24; it++) {
        const mx = 0.5*(ax+bx); const my = 0.5*(ay+by);
        const fm = evalC(mx,my);
        if (!Number.isFinite(fm)) break;
        if (Math.abs(fm) < 1e-8) { ax=mx; ay=my; break; }
        if (fa*fm <= 0) { bx=mx; by=my; fb=fm; } else { ax=mx; ay=my; fa=fm; }
      }
      return {x:ax,y:ay};
    };
    for (let k=0; k<curvePts.length-1; k++){
      const p = curvePts[k], q = curvePts[k+1];
      const cp = refineCOnSegment(p,q);
      if (cp) {
        const z = evalF(cp.x, cp.y);
        if (Number.isFinite(z)) candidates.push({ x: cp.x, y: cp.y, f: z });
      }
    }

    // Elimina duplicados cercanos
    const uniq = [];
    for (const c of candidates) {
      if (!uniq.some(u => Math.hypot(u.x - c.x, u.y - c.y) < 1e-3)) uniq.push(c);
    }
    return uniq;
  } catch (e) {
    console.warn('solveLagrangeLocal error:', e);
    return [];
  }
}

// Grafica la superficie f(x,y) con rango seguro y valores sanitizados
async function plotSurface(expression, contextData) {
  // Comentario: Genera la malla, sanitiza valores y renderiza con Plotly. Mantiene la última gráfica válida si hay errores.
  try {
    if (!window.Plotly) throw new Error("Plotly no está disponible");

    // Selección del contenedor: prioriza la sección de resultados (plot3d)
    const targetDiv = document.getElementById("plot3d") || graphDiv;
    const explBox = document.getElementById("plot3d-expl") || graphExplBox;

    // Selección de rango seguro según la expresión
    const range = pickSafeRangeForExpr(expression);
    const xVals = createRange(range.min, range.max, 41);
    const yVals = createRange(range.min, range.max, 41);

    // Evaluación local y sanitización de la malla Z
    const zRaw = evaluateGridLocal(expression, xVals, yVals);
    const z = sanitizeZGrid(zRaw);

    // Traza de superficie principal (azul semitransparente)
    const surfaceTrace = {
      type: "surface",
      x: xVals,
      y: yVals,
      z: z,
      colorscale: "Blues",
      opacity: 0.85,
    };

    // Punto evaluado (x0, y0, f(x0,y0)) en rojo
    let pointTrace = null;
    try {
      const x0s = normalizeNumericForBackend(x0Input?.value || "");
      const y0s = normalizeNumericForBackend(y0Input?.value || "");
      const x0 = Number(x0s);
      const y0 = Number(y0s);
      if (Number.isFinite(x0) && Number.isFinite(y0)) {
        const node = math.compile(normalizeExpressionForLocal(expression));
        const z0 = node.evaluate({ x: x0, y: y0 });
        const z0n = Number.isFinite(Number(z0)) ? Number(z0) : null;
        pointTrace = {
          type: "scatter3d",
          mode: "markers+text",
          x: [x0],
          y: [y0],
          z: [z0n],
          marker: { color: "red", size: 5 },
          text: [`Punto evaluado: (${x0}, ${y0}, ${z0n ?? 'no definido'})`],
          textposition: "top center",
        };
      }
    } catch (_) {
      // Comentario: Si falla el cálculo del punto, se omite el marcador sin romper la gráfica
    }

    const data = pointTrace ? [surfaceTrace, pointTrace] : [surfaceTrace];

    const layout = {
      title: "Superficie de f(x,y)",
      autosize: true,
      margin: { l: 0, r: 0, b: 0, t: 30 },
      scene: {
        xaxis: { title: "x" },
        yaxis: { title: "y" },
        zaxis: { title: "f(x,y)" },
      },
    };

    // Renderiza la gráfica. Si hay nulls, Plotly ignora esas celdas sin fallar.
    window.Plotly.newPlot(targetDiv, data, layout, { responsive: true });

    // Comentario: Explicación breve debajo de la gráfica con texto contextual
    if (explBox) {
      const tex = (() => {
        // Priorizar LaTeX del backend si existe
        if (contextData && typeof contextData.func_latex === "string" && contextData.func_latex.trim()) {
          return contextData.func_latex;
        }
        // Generar LaTeX localmente con Math.js de forma segura
        try {
          const node = math.parse(normalizeExpressionForLocal(expression));
          return node.toTex({ parenthesis: 'auto', implicit: 'hide' });
        } catch (e) {
          // Fallback sencillo: convertir ** -> ^ sin tocar paréntesis
          return normalizeExpressionForLocal(expression).replace(/\*\*/g, '^');
        }
      })();

      // Explicación contextual breve
      const brief = (() => {
        if (contextData && typeof contextData.graph_explanation === "string" && contextData.graph_explanation.trim()) {
          return contextData.graph_explanation;
        }
        const cx = analyzeExpressionType(expression);
        return cx.brief;
      })();

      explBox.innerHTML = `
        <h4>💬 Explicación de la gráfica</h4>
        <p>La superficie muestra el comportamiento de:</p>
        <div class="math-expression">${ensureBlockLatex(`f(x,y) = ${tex}`)}</div>
        <p>${brief}</p>
        <p>La altura <span class="math-expression">\\( z = f(x,y) \\)</span> representa el valor de la función para cada punto del plano <span class="math-expression">\\((x,y)\\)</span>.</p>
        <button id="seeMoreGraph" class="see-more-btn" style="margin-top:8px;">Ver desarrollo completo 🔍</button>
      `;
      // Migrado a KaTeX
      renderMathAll([explBox]);
      const btnGraph = document.getElementById("seeMoreGraph");
      btnGraph?.addEventListener("click", () => {
        const detailed = (() => {
          if (contextData && typeof contextData.graph_explanation_detailed === "string" && contextData.graph_explanation_detailed.trim()) {
            return contextData.graph_explanation_detailed;
          }
          const cx = analyzeExpressionType(expression);
          return cx.detailed;
        })();
        const modal = document.createElement("div");
        modal.classList.add("modal");
        modal.innerHTML = `
          <div class="modal-content">
            <h2>📈 Interpretación de la gráfica</h2>
            <div class="modal-body">${detailed}</div>
            <button id="closeModalGraph" class="close-modal">Cerrar</button>
          </div>
        `;
        document.body.appendChild(modal);
        // Migrado a KaTeX
        renderMathAll([modal]);
        const closeBtn = document.getElementById("closeModalGraph");
        closeBtn?.addEventListener("click", () => modal.remove());
        modal.addEventListener("click", (ev) => {
          if (ev.target === modal) modal.remove();
        });
      });
    }
  } catch (err) {
    // Comentario: Mostrar advertencia sin eliminar la última gráfica válida
    const explBox = document.getElementById("plot3d-expl") || graphExplBox;
    if (explBox) {
      explBox.innerHTML = `
        <p style="color:#b75a00">⚠️ No se pudo graficar la función en este dominio.</p>
      `;
    }
  }
}

// Controladores de botón
async function getPartials() {
  // Obtiene df/dx y df/dy del backend y muestra el resultado
  const expr = ensureExpression();
  if (!expr) return;
  // Si el backend no está disponible, usar cálculo local inmediato
  if (window.BACKEND_AVAILABLE === false) {
    const sym = trySymbolicPartials(expr);
    if (sym) {
      resultsBox.innerHTML = `
        <div class="result-card result-card--partials">
          <h3>∂f/∂x y ∂f/∂y (modo local)</h3>
          <p class="math-expression">$$\\frac{\\partial f}{\\partial x} = ${sym.fxTex}$$</p>
          <p class="math-expression">$$\\frac{\\partial f}{\\partial y} = ${sym.fyTex}$$</p>
          <p>Backend no disponible; derivadas simbólicas calculadas localmente.</p>
        </div>
        <div class="summary-card animate-fade">
          <div class="summary-title">Resultado</div>
          <p>Las derivadas parciales miden el cambio de la función al variar una variable manteniendo la otra fija.</p>
        </div>
      `;
      // Migrado a KaTeX
      renderMathAll([resultsBox]);
    } else {
      const x0 = Number((x0Input.value || "").trim() || NaN);
      const y0 = Number((y0Input.value || "").trim() || NaN);
      if (Number.isFinite(x0) && Number.isFinite(y0)) {
        const { fx, fy } = numericPartialsAt(expr, x0, y0);
        resultsBox.innerHTML = `
          <div class="result-card result-card--partials">
            <h3>∂f/∂x y ∂f/∂y en (${x0.toFixed(3)}, ${y0.toFixed(3)})</h3>
            <p class="math-expression">$$\\frac{\\partial f}{\\partial x}(${x0.toFixed(3)},\\,${y0.toFixed(3)}) \\approx ${fx.toFixed(6)}$$</p>
            <p class="math-expression">$$\\frac{\\partial f}{\\partial y}(${x0.toFixed(3)},\\,${y0.toFixed(3)}) \\approx ${fy.toFixed(6)}$$</p>
            <p>Backend no disponible; aproximación numérica local.</p>
          </div>
          <div class="summary-card animate-fade">
            <div class="summary-title">Resultado</div>
            <p>Valores aproximados de las derivadas parciales en el punto dado. Indican la tasa de cambio de f respecto a cada variable.</p>
          </div>
        `;
        renderMathAll([resultsBox]);
      } else {
        showError("Backend no disponible. Ingresa x0 e y0 para aproximación numérica o espera reconexión.");
      }
    }
    await draw3DGraph(expr, (x0Input.value || null), (y0Input.value || null), null);
    return;
  }
  try {
    const data = await postJSON("/partials", { expression: normalizeExpressionForBackend(expr) });
    showResult(data);
    // Renderiza pasos y explicación del backend
    renderSteps(data);
    // Comentario: Llamar a la gráfica 3D global con el mismo expr
    const x0 = (x0Input.value || "").trim();
    const y0 = (y0Input.value || "").trim();
    await draw3DGraph(expr, x0 || null, y0 || null, null);
  } catch (err) {
    // Comentario: Si falla el backend, aún intentamos graficar localmente la función
    showError(err.message);
    // Cálculo local de respaldo
    const sym = trySymbolicPartials(expr);
    if (sym) {
      resultsBox.innerHTML = `
        <div class="result-card result-card--partials">
          <h3>∂f/∂x y ∂f/∂y (modo local)</h3>
          <p class="math-expression">$$\\frac{\\partial f}{\\partial x} = ${sym.fxTex}$$</p>
          <p class="math-expression">$$\\frac{\\partial f}{\\partial y} = ${sym.fyTex}$$</p>
        </div>
        <div class="summary-card animate-fade">
          <div class="summary-title">Resultado</div>
          <p>Las derivadas parciales indican cómo varía f con cada variable de forma independiente.</p>
        </div>
      `;
      // Migrado a KaTeX
      renderMathAll([resultsBox]);
    } else {
      const x0 = Number((x0Input.value || "").trim() || NaN);
      const y0 = Number((y0Input.value || "").trim() || NaN);
      if (Number.isFinite(x0) && Number.isFinite(y0)) {
        const { fx, fy } = numericPartialsAt(expr, x0, y0);
        resultsBox.innerHTML = `
          <div class="result-card result-card--partials">
            <h3>∂f/∂x y ∂f/∂y en (${x0.toFixed(3)}, ${y0.toFixed(3)})</h3>
            <p class="math-expression">$$\\frac{\\partial f}{\\partial x}(${x0.toFixed(3)},\\,${y0.toFixed(3)}) \\approx ${fx.toFixed(6)}$$</p>
            <p class="math-expression">$$\\frac{\\partial f}{\\partial y}(${x0.toFixed(3)},\\,${y0.toFixed(3)}) \\approx ${fy.toFixed(6)}$$</p>
          </div>
          <div class="summary-card animate-fade">
            <div class="summary-title">Resultado</div>
            <p>Estimaciones locales de ∂f/∂x y ∂f/∂y que describen la pendiente en dirección de cada eje.</p>
          </div>
        `;
        renderMathAll([resultsBox]);
      }
    }
    try { await draw3DGraph(expr); } catch (_) {}
  }
}

async function getGradient() {
  // Obtiene el gradiente (fx, fy) del backend y muestra el resultado
  const expr = ensureExpression();
  if (!expr) return;
  if (window.BACKEND_AVAILABLE === false) {
    const sym = trySymbolicPartials(expr);
    if (sym) {
      resultsBox.innerHTML = `
        <div class="result-card result-card--gradient">
          <h3>∇f (modo local)</h3>
          <p class="math-expression">$$\\nabla f = \\langle ${sym.fxTex},\, ${sym.fyTex} \\rangle$$</p>
          <p>Backend no disponible; gradiente simbólico calculado localmente.</p>
        </div>
        <div class="summary-card animate-fade">
          <div class="summary-title">Interpretación</div>
          <p>El gradiente apunta hacia la dirección de mayor incremento de \(f\) y su norma indica la tasa máxima de cambio.</p>
        </div>
      `;
      // Migrado a KaTeX
      renderMathAll([resultsBox]);
    } else {
      const x0 = Number((x0Input.value || "").trim() || NaN);
      const y0 = Number((y0Input.value || "").trim() || NaN);
      if (Number.isFinite(x0) && Number.isFinite(y0)) {
        const { fx, fy } = numericPartialsAt(expr, x0, y0);
        resultsBox.innerHTML = `
          <div class="result-card result-card--gradient">
            <h3>∇f en (${x0.toFixed(3)}, ${y0.toFixed(3)})</h3>
            <p class="math-expression">$$\\nabla f(${x0.toFixed(3)},\\,${y0.toFixed(3)}) \\approx \\langle ${fx.toFixed(6)},\\, ${fy.toFixed(6)} \\rangle$$</p>
            <p>Backend no disponible; aproximación numérica local.</p>
          </div>
          <div class="summary-card animate-fade">
            <div class="summary-title">Resultado</div>
            <p>Dirección de máximo crecimiento estimada por el gradiente.</p>
            <p class="math-expression">$$\\langle ${fx.toFixed(6)},\\, ${fy.toFixed(6)} \\rangle$$</p>
          </div>
        `;
        renderMathAll([resultsBox]);
      } else {
        showError("Backend no disponible. Ingresa x0 e y0 para aproximar ∇f o espera reconexión.");
      }
    }
    await draw3DGraph(expr, (x0Input.value || null), (y0Input.value || null), null);
    return;
  }
  try {
    const data = await postJSON("/gradient", { expression: normalizeExpressionForBackend(expr) });
    showResult(data);
    renderSteps(data);
    // Agregar resumen conceptual del gradiente
    resultsBox.innerHTML += `
      <div class="summary-card animate-fade">
        <div class="summary-title">Interpretación</div>
        <p>El gradiente reúne las derivadas parciales y apunta donde \(f\) aumenta más rápido. Su magnitud es la tasa máxima de cambio local.</p>
      </div>
    `;
    renderMathAll([resultsBox]);
    // Actualiza la gráfica 3D usando la función global
    const x0 = (x0Input.value || "").trim();
    const y0 = (y0Input.value || "").trim();
    await draw3DGraph(expr, x0 || null, y0 || null, null);
  } catch (err) {
    showError(err.message);
    // Comentario: Si falla el backend, aún intentamos graficar localmente la función
    const sym = trySymbolicPartials(expr);
    if (sym) {
      resultsBox.innerHTML = `
        <div class="result-card result-card--gradient">
          <h3>∇f (modo local)</h3>
          <p class="math-expression">$$\\nabla f = \\langle ${sym.fxTex},\, ${sym.fyTex} \\rangle$$</p>
        </div>
        <div class="summary-card animate-fade">
          <div class="summary-title">Interpretación</div>
          <p>Vector que apunta en la dirección de máximo incremento de \(f\).</p>
        </div>
      `;
      // Migrado a KaTeX
      renderMathAll([resultsBox]);
    } else {
      const x0 = Number((x0Input.value || "").trim() || NaN);
      const y0 = Number((y0Input.value || "").trim() || NaN);
      if (Number.isFinite(x0) && Number.isFinite(y0)) {
        const { fx, fy } = numericPartialsAt(expr, x0, y0);
        resultsBox.innerHTML = `
          <div class="result-card result-card--gradient">
            <h3>∇f en (${x0.toFixed(3)}, ${y0.toFixed(3)})</h3>
            <p class="math-expression">\(fx \approx ${fx.toFixed(6)}\)</p>
            <p class="math-expression">\(fy \approx ${fy.toFixed(6)}\)</p>
          </div>
          <div class="summary-card animate-fade">
            <div class="summary-title">Resultado</div>
            <p>Dirección estimada de máximo crecimiento.</p>
            <p class="math-expression">$$\\langle ${fx.toFixed(6)},\\, ${fy.toFixed(6)} \\rangle$$</p>
          </div>
        `;
        renderMathAll([resultsBox]);
      }
    }
    try { await draw3DGraph(expr); } catch (_) {}
  }
}

async function evaluateFunction() {
  // Evalúa la función y grafica; si hay (x0,y0) también muestra el valor en ese punto
  const expr = ensureExpression();
  if (!expr) return;
  const x0 = (x0Input.value || "").trim();
  const y0 = (y0Input.value || "").trim();
  const x0n = normalizeNumericForBackend(x0);
  const y0n = normalizeNumericForBackend(y0);
  try {
    let data = null;
    if (x0 && y0) {
      // Comentario: Solo llamamos al backend si hay punto de evaluación
      data = await postJSON("/evaluate", { expression: normalizeExpressionForBackend(expr), x0: x0n, y0: y0n });
      const val = typeof data?.value === "number" && Number.isFinite(data.value) ? data.value : NaN;
      const latex = typeof data?.resultado_latex === "string" ? data.resultado_latex : `f(${x0n}, ${y0n})`;
      resultsBox.innerHTML = `
        <div class="result-card result-card--evaluation">
          <h3>📊 Resultado de la Evaluación:</h3>
          <p class="math-expression">$$${latex}$$</p>
          ${Number.isFinite(val) ? `<p class=\"math-expression\">$$\\text{Valor numérico} = ${val.toFixed(6)}$$</p>` : ""}
          ${data?.explanation ? `<p>${data.explanation}</p>` : ""}
        </div>
        ${Number.isFinite(val) ? `
        <div class="summary-card animate-fade">
          <div class="summary-title">Resultado</div>
          <p>El valor de la función en el punto dado indica la altura de la superficie en esa coordenada.</p>
          <p class="math-expression">$$${val.toFixed(6)}$$</p>
        </div>` : ''}
      `;
      // Migrado a KaTeX
      renderMathAll([resultsBox]);
      renderSteps(data);
    } else {
      // Sin punto: mostrar la expresión en LaTeX para confirmar la función
      let tex = "";
      try {
        const node = math.parse(normalizeExpressionForLocal(expr));
        tex = node.toTex({ parenthesis: 'auto', implicit: 'hide' });
      } catch (_) {
        tex = normalizeExpressionForLocal(expr).replace(/\*\*/g, '^');
      }
      resultsBox.innerHTML = `
        <div class="result-card result-card--evaluation">
          <h3>📋 Expresión ingresada:</h3>
          <p class="math-expression">$$f(x,y) = ${tex}$$</p>
          <p>Para evaluar numéricamente, ingresa <b>x0</b> y <b>y0</b>.</p>
        </div>
        <div class="summary-card animate-fade">
          <div class="summary-title">Resultado</div>
          <p>Has ingresado la función. Para obtener un valor, proporciona un punto de evaluación.</p>
        </div>
      `;
      // Migrado a KaTeX
      renderMathAll([resultsBox]);
    }
    // Comentario: Graficar siempre la superficie; si hay un valor evaluado, mostrarlo como punto
    const fVal = (data && typeof data.value === "number" && Number.isFinite(data.value)) ? data.value : null;
    await draw3DGraph(expr, x0 || null, y0 || null, fVal);
  } catch (err) {
    // Comentario: Si falla el backend, aún intentamos graficar localmente la función
    showError(err.message);
    try {
      if (x0 && y0) {
        // Evaluación local del valor
        const xNum = Number(math?.evaluate ? math.evaluate(normalizeNumericForBackend(x0)) : x0);
        const yNum = Number(math?.evaluate ? math.evaluate(normalizeNumericForBackend(y0)) : y0);
        const valLocal = evaluateLocalAtPoint(expr, xNum, yNum);
        let tex = "";
        try {
          const node = math.parse(normalizeExpressionForLocal(expr));
          tex = node.toTex({ parenthesis: 'auto', implicit: 'hide' });
        } catch (_) {
          tex = normalizeExpressionForLocal(expr).replace(/\*\*/g, '^');
        }
        resultsBox.innerHTML = `
          <div class="result-card result-card--evaluation">
            <h3>📊 Resultado (modo local):</h3>
            <p class="math-expression">$$f(x,y) = ${tex}$$</p>
            ${Number.isFinite(valLocal) ? `<p class=\"math-expression\">$$f(${xNum.toFixed(3)},\\,${yNum.toFixed(3)}) \\approx ${valLocal.toFixed(6)}$$</p>` : `<p>No se pudo evaluar numéricamente en el punto ingresado.</p>`}
            <p>El backend no está disponible; se calculó con el evaluador local.</p>
          </div>
          ${Number.isFinite(valLocal) ? `
          <div class="summary-card animate-fade">
            <div class="summary-title">Resultado</div>
            <p>Altura aproximada de la superficie en el punto evaluado.</p>
            <p class="math-expression">$$${valLocal.toFixed(6)}$$</p>
          </div>` : ''}
        `;
        // Migrado a KaTeX
        renderMathAll([resultsBox]);
        await draw3DGraph(expr, x0, y0, Number.isFinite(valLocal) ? valLocal : null);
      } else {
        // Sin punto: mostrar solo la expresión y graficar
        let tex = "";
        try {
          const node = math.parse(normalizeExpressionForLocal(expr));
          tex = node.toTex({ parenthesis: 'auto', implicit: 'hide' });
        } catch (_) {
          tex = normalizeExpressionForLocal(expr).replace(/\*\*/g, '^');
        }
        resultsBox.innerHTML = `
          <div class="result-card result-card--evaluation">
            <h3>📋 Expresión (modo local):</h3>
            <p class="math-expression">$$f(x,y) = ${tex}$$</p>
            <p>Ingresa <b>x0</b> y <b>y0</b> para evaluar numéricamente.</p>
          </div>
          <div class="summary-card animate-fade">
            <div class="summary-title">Resultado</div>
            <p>Función cargada correctamente. Evalúa en un punto para obtener un valor.</p>
          </div>
        `;
        // Migrado a KaTeX
        renderMathAll([resultsBox]);
        await draw3DGraph(expr);
      }
    } catch (_) {
      // Si también falla el graficado, dejamos la advertencia en el bloque de explicación
    }
  }
}

async function getDoubleIntegral() {
  // Calcula la integral doble definida en límites rectangulares
  // Comentario: Se obtiene la función y los límites desde el DOM
  const expr = ensureExpression();
  if (!expr) return;

  // Comentario: Leer límites como texto y normalizar para permitir simbología
  const xStartEl = document.getElementById("xStart");
  const xEndEl = document.getElementById("xEnd");
  const yStartEl = document.getElementById("yStart");
  const yEndEl = document.getElementById("yEnd");
  const x0s = normalizeNumericForBackend(xStartEl ? xStartEl.value : "");
  const x1s = normalizeNumericForBackend(xEndEl ? xEndEl.value : "");
  const y0s = normalizeNumericForBackend(yStartEl ? yStartEl.value : "");
  const y1s = normalizeNumericForBackend(yEndEl ? yEndEl.value : "");

  const allEmpty = [x0s, x1s, y0s, y1s].every((v) => !v);
  const allProvided = [x0s, x1s, y0s, y1s].every((v) => !!v);
  if (!allEmpty && !allProvided) {
    showError("Por favor ingresa todos los límites de integración o deja todos vacíos.");
    return;
  }

  try {
    if (window.BACKEND_AVAILABLE === false) {
      // Si se requiere backend, no hacer cálculo local
      if (window.REQUIRE_BACKEND) {
        showError("El backend es requerido para esta operación. Inícialo en http://127.0.0.1:5000.");
        await draw3DGraph(expr);
        return;
      }
      // Fallback local
      if (allProvided) {
        const xn0 = parseNumberFlexible(xStartEl?.value);
        const xn1 = parseNumberFlexible(xEndEl?.value);
        const yn0 = parseNumberFlexible(yStartEl?.value);
        const yn1 = parseNumberFlexible(yEndEl?.value);
        if ([xn0,xn1,yn0,yn1].every(Number.isFinite)) {
          const approx = numericDoubleIntegralRect(expr, xn0, xn1, yn0, yn1);
          resultsBox.innerHTML = `
            <div class="result-card result-card--integral">
              <h3>Resultado (modo local):</h3>
            <p class="math-expression">$$\\iint f(x,y)\\,dx\\,dy \\approx ${approx.toFixed(6)}$$</p>
              <p>Backend no disponible; se usa suma de Riemann sobre rejilla.</p>
            </div>
            <div class="summary-card animate-fade">
              <div class="summary-title">Interpretación</div>
              <p>Volumen aproximado bajo \(f(x,y)\) sobre la región rectangular indicada.</p>
            <p class="math-expression">$$${approx.toFixed(6)}$$</p>
            </div>
          `;
          renderMathAll([resultsBox]);
        } else {
          showError("Límites inválidos para cálculo local. Usa valores numéricos.");
        }
      } else {
        // Sin límites: usar un rango seguro por defecto y calcular aproximación numérica
        const range = pickSafeRangeForExpr(expr);
        const approx = numericDoubleIntegralRect(expr, range.min, range.max, range.min, range.max);
        resultsBox.innerHTML = `
          <div class="result-card result-card--integral">
            <h3>Resultado (modo local):</h3>
            <p class="math-expression">$$\\iint_{[${range.min},${range.max}]\\times[${range.min},${range.max}]} f(x,y)\\,dx\\,dy \\approx ${approx.toFixed(6)}$$</p>
            <p>Sin límites: se usa un rango por defecto basado en la función.</p>
          </div>
          <div class="summary-card animate-fade">
            <div class="summary-title">Interpretación</div>
            <p>Volumen aproximado bajo \(f(x,y)\) en el rectángulo por defecto.</p>
            <p class="math-expression">$$${approx.toFixed(6)}$$</p>
          </div>
        `;
        renderMathAll([resultsBox]);
      }
      await draw3DGraph(expr);
      if (allProvided) {
        const zBase = 0;
        const rect = {
          type: "scatter3d", mode: "lines",
          x: [xStartEl?.value || 0, xEndEl?.value || 0, xEndEl?.value || 0, xStartEl?.value || 0, xStartEl?.value || 0],
          y: [yStartEl?.value || 0, yStartEl?.value || 0, yEndEl?.value || 0, yEndEl?.value || 0, yStartEl?.value || 0],
          z: [zBase, zBase, zBase, zBase, zBase],
          line: { color: "#00C853", width: 6 }, name: "Región de integración", opacity: 0.7,
        };
        window.Plotly.addTraces(graphDiv, [rect]);
      }
      return;
    }
    // Comentario: Normaliza la expresión y arma el payload con el formato requerido
    const func = normalizeExpressionForBackend(expr);
    const payload = allEmpty
      ? { function: func, xlim: null, ylim: null }
      : { function: func, xlim: [x0s, x1s], ylim: [y0s, y1s] };
    const data = await postJSON("/double-integral", payload);

    // Comentario: Mostrar el resultado en tarjeta visual con campos LaTeX del backend
    if (data.type === "definite") {
      const approx = typeof data.approx === "number" && Number.isFinite(data.approx) ? data.approx.toFixed(3) : null;
      const expr1 = data.definite_symbolic_latex || data.expression_latex || "";
      const expr2 = data.integral_latex || "";
      resultsBox.innerHTML = `
        <div class="result-card result-card--integral">
          <h3>Resultado:</h3>
          ${expr1 ? `<p class="math-expression">${ensureBlockLatex(expr1)}</p>` : ''}
          ${expr2 ? `<p class="math-expression">${ensureBlockLatex(expr2)}</p>` : ''}
            ${approx ? `<p class=\"math-expression\">$$\\text{Valor numérico} = ${approx}$$</p>` : ""}
        </div>
        <div class="summary-card animate-fade">
          <div class="summary-title">Interpretación</div>
          <p>La integral doble definida calcula el volumen bajo la superficie \(f(x,y)\) sobre la región delimitada por los límites.</p>
          ${approx ? `<p class="math-expression">$$${approx}$$</p>` : ''}
        </div>
      `;
    } else if (data.type === "indefinite") {
      const inner = data.inner_integral_latex || data.inner_integral || "";
      const outer = data.double_integral_latex || data.double_integral || "";
      const doubleSym = data.double_integral_symbolic_latex || "";
      resultsBox.innerHTML = `
        <div class="result-card">
          <h3>Resultado:</h3>
          ${inner ? `<p class="math-expression">${ensureBlockLatex(inner)}</p>` : ''}
          ${outer ? `<p class="math-expression">${ensureBlockLatex(outer)}</p>` : ''}
          ${doubleSym ? `<p class="math-expression">${ensureBlockLatex(doubleSym)}</p>` : ''}
        </div>
      `;
    } else {
      showResult(data);
    }
    if (data.type === "indefinite") {
      resultsBox.innerHTML += `
        <div class="summary-card animate-fade">
          <div class="summary-title">Interpretación</div>
          <p>Se muestra una antiderivada simbólica (integral indefinida). No representa un volumen sin límites.</p>
        </div>
      `;
      // Además, ofrecer una aproximación numérica en un rango por defecto
      const rangeDef = pickSafeRangeForExpr(expr);
      const approxDef = numericDoubleIntegralRect(expr, rangeDef.min, rangeDef.max, rangeDef.min, rangeDef.max);
      resultsBox.innerHTML += `
        <div class="summary-card animate-fade">
          <div class="summary-title">Aproximación numérica (rango por defecto)</div>
          <p>Estimación sobre la región:</p>
          <p class="math-expression">$$ x \\in [${rangeDef.min},${rangeDef.max}],\\\ y \\in [${rangeDef.min},${rangeDef.max}] $$</p>
          <p class="math-expression">$$\\iint f(x,y)\\,dx\\,dy \\approx ${approxDef.toFixed(6)}$$</p>
        </div>
      `;
    }
    renderMathAll([resultsBox]);

    // Comentario: Renderiza pasos y explicación del backend
    renderSteps(data);

    // Comentario: Actualiza la gráfica 3D para la función ingresada
    await draw3DGraph(expr);
    // Comentario: Si hay límites definidos, resalta el rectángulo de integración en el plano xy
    if (allProvided) {
      const zBase = 0; // Plano base para resaltar la región
      const rect = {
        type: "scatter3d",
        mode: "lines",
        x: [xStartEl?.value || 0, xEndEl?.value || 0, xEndEl?.value || 0, xStartEl?.value || 0, xStartEl?.value || 0],
        y: [yStartEl?.value || 0, yStartEl?.value || 0, yEndEl?.value || 0, yEndEl?.value || 0, yStartEl?.value || 0],
        z: [zBase, zBase, zBase, zBase, zBase],
        line: { color: "#00C853", width: 6 },
        name: "Región de integración",
        opacity: 0.7,
      };
      window.Plotly.addTraces(graphDiv, [rect]);
      if (graphExplBox) {
        graphExplBox.innerHTML += `<p>🔍 El rectángulo de integración en el plano xy está resaltado en verde.</p>`;
      }
    }
  } catch (err) {
    showError(err.message);
    // Comentario: Si falla el backend, aún intentamos graficar localmente la función
    // Fallback local (solo si no se requiere backend)
    if (window.REQUIRE_BACKEND) {
      try { await draw3DGraph(expr); } catch (_) {}
      return;
    }
    // Fallback local
    if (allProvided) {
      const xn0 = parseNumberFlexible(xStartEl?.value);
      const xn1 = parseNumberFlexible(xEndEl?.value);
      const yn0 = parseNumberFlexible(yStartEl?.value);
      const yn1 = parseNumberFlexible(yEndEl?.value);
      if ([xn0,xn1,yn0,yn1].every(Number.isFinite)) {
        const approx = numericDoubleIntegralRect(expr, xn0, xn1, yn0, yn1);
        resultsBox.innerHTML = `
          <div class="result-card">
            <h3>Resultado (modo local):</h3>
            <p class="math-expression">$$\\iint_{[x_0,x_1]\\times[y_0,y_1]} f(x,y)\\,dx\\,dy \\approx ${approx.toFixed(6)}$$</p>
          </div>
        `;
      }
    }
    try { await draw3DGraph(expr); } catch (_) {}
  }
}

async function getLagrange() {
  // Aplica el método de Lagrange con restricción g(x,y)=0
  // Comentario: Al abrir Lagrange, guiar entrada con placeholders y un mensaje educativo
  try {
    const ip = document.getElementById("input-panel");
    if (ip && !document.getElementById("lagrange-guide")) {
      const guide = document.createElement("div");
      guide.id = "lagrange-guide";
      guide.className = "result-card animate-fade";
      guide.innerHTML = `
        <h3>💡 Guía de Lagrange</h3>
        <p class="math-expression">Ingresa la función objetivo \( f(x,y) \) y la restricción \( g(x,y)=0 \). El sistema aplicará el método de Lagrange paso a paso.</p>
        <p class="math-expression">Ejemplos: ${ensureBlockLatex('f(x,y)=x+y')}, ${ensureBlockLatex('g(x,y)=x^2+y^2-8')}.</p>
      `;
      ip.insertAdjacentElement("afterbegin", guide);
      renderMathAll([guide]);
    }
    // Ajustar placeholders para orientar al usuario
    const fInput = document.getElementById("function") || document.getElementById("expression");
    const gInput = document.getElementById("constraint");
    if (fInput) fInput.placeholder = "Ej: x + y";
    if (gInput) gInput.placeholder = "Ej: x**2 + y**2 - 8";
  } catch {}

  const expr = ensureExpression();
  if (!expr) return;
  const constraint = (constraintInput.value || "").trim();
  if (!constraint) {
    showError("Por favor ingresa la restricción g(x,y).");
    return;
  }
  try {
    const payload = { expression: normalizeExpressionForBackend(expr), constraint: normalizeExpressionForBackend(constraint) };
    const data = await postJSON("/lagrange", payload);
    // Renderizado de resultados en tarjetas educativas y explicación ampliada
    const pts = Array.isArray(data?.critical_points) ? data.critical_points : [];
    const hasPts = pts.length > 0;
    const funcLatex = typeof data?.func_latex === "string" ? data.func_latex : null;
    const constrLatex = (() => {
      try {
        const node = math.parse(normalizeExpressionForLocal(constraint));
        return node.toTex({ parenthesis: 'auto', implicit: 'hide' });
      } catch {
        return constraint.replace(/\*\*/g, '^');
      }
    })();
    // Clasificación básica de máximos y mínimos por comparación de valores de f
    const vals = pts.map(p => Number(p.f)).filter(Number.isFinite);
    const maxF = vals.length ? Math.max(...vals) : null;
    const minF = vals.length ? Math.min(...vals) : null;
    const classify = (p) => {
      const fv = Number(p.f);
      if (!Number.isFinite(fv)) return { label: "Candidato", color: "#ffc107" };
      if (maxF !== null && Math.abs(fv - maxF) < 1e-10) return { label: "Máximo", color: "#28a745" };
      if (minF !== null && Math.abs(fv - minF) < 1e-10) return { label: "Mínimo", color: "#007bff" };
      return { label: "Candidato", color: "#ffc107" };
    };
    resultsBox.innerHTML = `
      <div class="result-card result-card--lagrange animate-fade">
        <h3>🎯 Optimización con Restricción (Lagrange)</h3>
        <p class="math-expression">Función objetivo: ${ensureBlockLatex(`f(x,y) = ${funcLatex || normalizeExpressionForLocal(expr).replace(/\*\*/g,'^')}`)}</p>
        <p class="math-expression">Restricción: ${ensureBlockLatex(`g(x,y) = ${constrLatex} = 0`)}</p>
        ${hasPts ? `<p><b>Puntos críticos encontrados:</b></p>
        <ul>${pts.map(p => { const c = classify(p); return `<li>\(x=${Number(p.x).toFixed(4)},\;y=${Number(p.y).toFixed(4)}\) &rarr; \(f=${(p.f!=null && Number.isFinite(Number(p.f)))?Number(p.f).toFixed(6):'\\text{no disponible}'}\) → <span style="color:${c.color}"><b>${c.label}</b></span></li>`; }).join("")}</ul>
        <p><i>Los valores extremos se encuentran sobre la curva de restricción \( g(x,y)=0 \).</i></p>`
        : `<p style="color:#b75a00">No se encontraron puntos que cumplan la restricción.</p>`}
      </div>
      <div class="summary-card animate-fade">
        <div class="summary-title">Interpretación</div>
        <p>El método de Lagrange permite hallar extremos de \(f(x,y)\) sujetos a la restricción \(g(x,y)=0\). El parámetro \(\lambda\) mide la influencia de la restricción sobre el óptimo.</p>
      </div>
    `;
    // Explicación ampliada del método de Lagrange (sección educativa)
    const stepsData = Array.isArray(data?.steps) ? data.steps : [];
    const isObjSteps = stepsData.length && typeof stepsData[0] === 'object' && ('description' in stepsData[0]);
    const resultadoLatex = typeof data?.resultado_latex === "string" ? data.resultado_latex : "";
    const fLatex = funcLatex || normalizeExpressionForLocal(expr).replace(/\*\*/g,'^');
    const gLatex = constrLatex;
    if (isObjSteps) {
      const eduHtml = stepsData.map(s => `<p>${s.description}</p><div class="math-expression">${ensureBlockLatex(s.latex)}</div>`).join('');
      stepsBox.innerHTML = `
        <div class="result-card explanation-box animate-fade">
          <h3>🧩 ${typeof data?.title === 'string' ? data.title : 'Proceso paso a paso del método de Lagrange'}</h3>
          ${typeof data?.summary === 'string' ? `<div class="math-expression">${ensureBlockLatex(data.summary)}</div>` : ''}
          ${eduHtml}
        </div>
      `;
    } else {
      stepsBox.innerHTML = `
        <div class="result-card explanation-box animate-fade">
          <h3>🧩 Proceso paso a paso del método de Lagrange</h3>
          <ol>
            <li>1️⃣ Se forma la función de Lagrange: $$L(x,y,\\lambda)= ${fLatex} - \\lambda\\,( ${gLatex} )$$</li>
            <li>2️⃣ Se calculan las derivadas parciales y se imponen a cero: $$\\frac{\\partial L}{\\partial x}=0,\\;\\frac{\\partial L}{\\partial y}=0,\\;\\frac{\\partial L}{\\partial \\lambda}=0$$</li>
            <li>3️⃣ Se resuelve el sistema para \\((x,y,\\lambda)\\). ${resultadoLatex ? `Solución: ${ensureBlockLatex(resultadoLatex)}` : ''}</li>
            <li>4️⃣ Se evalúa \\(f(x,y)\\) en los puntos críticos.</li>
            <li>5️⃣ Se determina cuál es máximo o mínimo comparando los valores de \\(f\\).</li>
          </ol>
          ${stepsData.length ? `<h4>📘 Desarrollo simbólico (del servidor)</h4><ul>${stepsData.map(s => `<li>${s}</li>`).join('')}</ul>` : ''}
        </div>
      `;
    }
    // Comentario: Modal "Ver más" si hay explicación extendida
    const explanationDetailed = typeof data?.explanation_detailed === "string" ? data.explanation_detailed : "";
    if (explanationDetailed) {
      const moreBtn = document.createElement('button');
      moreBtn.id = 'seeMoreBtn';
      moreBtn.className = 'see-more-btn';
      moreBtn.textContent = 'Ver desarrollo completo 🔍';
      stepsBox.appendChild(moreBtn);
      moreBtn.addEventListener('click', () => {
        const modal = document.createElement('div');
        modal.classList.add('modal');
        modal.innerHTML = `
          <div class="modal-content">
            <h2>🧠 Explicación detallada</h2>
            <p class="modal-body">${explanationDetailed}</p>
            <button id="closeModal" class="close-modal">Cerrar</button>
          </div>
        `;
        document.body.appendChild(modal);
        renderMathAll([modal]);
        const closeBtn = document.getElementById('closeModal');
        closeBtn?.addEventListener('click', () => modal.remove());
        modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
      });
    }
    // Graficar superficie y superponer curva de restricción y puntos
    await draw3DGraph(expr);
    await drawConstraintCurveOnSurface(expr, constraint);
    if (hasPts) {
      // Construir trazas separadas para máximos (verde) y mínimos (azul)
      const maxXs = [], maxYs = [], maxZs = [], maxLabels = [];
      const minXs = [], minYs = [], minZs = [], minLabels = [];
      const fNode = math.compile(normalizeExpressionForLocal(expr));
      for (const p of pts) {
        const x = Number(p.x); const y = Number(p.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
        let z = (p.f!=null && Number.isFinite(Number(p.f))) ? Number(p.f) : NaN;
        if (!Number.isFinite(z)) {
          try { z = Number(fNode.evaluate({ x, y })); } catch { z = NaN; }
        }
        if (!Number.isFinite(z)) continue;
        const c = classify(p);
        if (c.label === "Máximo") {
          maxXs.push(x); maxYs.push(y); maxZs.push(z);
          maxLabels.push(`Máximo: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
        } else if (c.label === "Mínimo") {
          minXs.push(x); minYs.push(y); minZs.push(z);
          minLabels.push(`Mínimo: (${x.toFixed(3)}, ${y.toFixed(3)}, ${z.toFixed(3)})`);
        }
      }
      const traces = [];
      if (maxXs.length) {
        traces.push({ type: 'scatter3d', mode: 'markers+text', x: maxXs, y: maxYs, z: maxZs, marker: { color: '#28a745', size: 0 }, text: maxLabels, textposition: 'top center', name: 'Máximos' });
      }
      if (minXs.length) {
        traces.push({ type: 'scatter3d', mode: 'markers+text', x: minXs, y: minYs, z: minZs, marker: { color: '#007bff', size: 0 }, text: minLabels, textposition: 'top center', name: 'Mínimos' });
      }
      if (traces.length) {
        const baseLen = (graphDiv.data || []).length;
        window.Plotly.addTraces(graphDiv, traces).then(() => {
          // Animación de aparición (pop) para todas las trazas añadidas
          const idxs = traces.map((_, i) => baseLen + i);
          setTimeout(() => {
            try { window.Plotly.restyle(graphDiv, { 'marker.size': 7 }, idxs); } catch {}
          }, 140);
        }).catch(() => {});
      }
    }
    // Renderizar KaTeX en tarjetas
    renderMathAll([resultsBox, stepsBox]);
  } catch (err) {
    showError(err.message);
    // Comentario: Si falla el backend, intentamos un cálculo local aproximado del método de Lagrange
    try {
      // Guía al usuario y calcula candidatos locales
      resultsBox.innerHTML = `
        <div class="result-card animate-fade">
          <h3>⚠️ Modo local (aproximado)</h3>
          <p>No se pudo contactar el servidor. Se intentará encontrar puntos críticos con Lagrange de forma numérica sobre la restricción.</p>
        </div>
      `;
      await draw3DGraph(expr);
      const candidates = await solveLagrangeLocal(expr, constraint);
      await drawConstraintCurveOnSurface(expr, constraint);

      if (candidates.length) {
        const vals = candidates.map(p => Number(p.f)).filter(Number.isFinite);
        const maxF = vals.length ? Math.max(...vals) : null;
        const minF = vals.length ? Math.min(...vals) : null;
        const classify = (p) => {
          const fv = Number(p.f);
          if (!Number.isFinite(fv)) return { label: "Candidato", color: "#ffc107" };
          if (maxF !== null && Math.abs(fv - maxF) < 1e-8) return { label: "Máximo", color: "#28a745" };
          if (minF !== null && Math.abs(fv - minF) < 1e-8) return { label: "Mínimo", color: "#007bff" };
          return { label: "Candidato", color: "#ffc107" };
        };
        // Mostrar lista en tarjeta
        resultsBox.innerHTML += `
          <div class="result-card animate-fade">
            <h3>🎯 Puntos críticos (método local aproximado)</h3>
            <ul>
              ${candidates.map(p=>{ const c = classify(p); return `<li>\(x=${p.x.toFixed(4)},\;y=${p.y.toFixed(4)}\) → \(f=${p.f.toFixed(6)}\) → <b style="color:${c.color}">${c.label}</b></li>`; }).join('')}
            </ul>
            <p><i>Clasificación tentativa basada en valores de \(f\).</i></p>
          </div>
        `;
        // Añadir puntos al gráfico
        const maxXs=[], maxYs=[], maxZs=[], maxLabels=[];
        const minXs=[], minYs=[], minZs=[], minLabels=[];
        for (const p of candidates) {
          const c = classify(p);
          if (c.label === 'Máximo') { maxXs.push(p.x); maxYs.push(p.y); maxZs.push(p.f); maxLabels.push(`Máximo: (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.f.toFixed(3)})`); }
          else if (c.label === 'Mínimo') { minXs.push(p.x); minYs.push(p.y); minZs.push(p.f); minLabels.push(`Mínimo: (${p.x.toFixed(3)}, ${p.y.toFixed(3)}, ${p.f.toFixed(3)})`); }
        }
        const traces=[];
        if (maxXs.length) traces.push({ type:'scatter3d', mode:'markers+text', x:maxXs, y:maxYs, z:maxZs, marker:{color:'#28a745', size:0}, text:maxLabels, textposition:'top center', name:'Máximos (local)' });
        if (minXs.length) traces.push({ type:'scatter3d', mode:'markers+text', x:minXs, y:minYs, z:minZs, marker:{color:'#007bff', size:0}, text:minLabels, textposition:'top center', name:'Mínimos (local)' });
        if (traces.length) {
          const baseLen = (graphDiv.data || []).length;
          window.Plotly.addTraces(graphDiv, traces).then(() => {
            const idxs = traces.map((_, i) => baseLen + i);
            setTimeout(() => { try { window.Plotly.restyle(graphDiv, { 'marker.size': 7 }, idxs); } catch {} }, 140);
          }).catch(()=>{});
        }
      } else {
        resultsBox.innerHTML += `
          <div class="result-card animate-fade">
            <p style="color:#b75a00">No se hallaron candidatos locales. Intenta ajustar la restricción o el rango.</p>
          </div>
        `;
      }
      renderMathAll([resultsBox]);
    } catch (_) {
      // Si también falla el graficado, dejamos la advertencia visible
    }
  }
}

// Optimización sin restricciones
async function optimizeFunction() {
  const expr = ensureExpression();
  // Comentario: Mapear clasificaciones a color y emoji para etiquetas
  const classStyle = (cls) => {
    const c = (cls || "").toLowerCase();
    if (c.includes("mínimo")) return { color: "red", emoji: "🔴", label: "Mínimo local" };
    if (c.includes("máximo")) return { color: "green", emoji: "🟢", label: "Máximo local" };
    if (c.includes("silla")) return { color: "gold", emoji: "🟡", label: "Punto de silla" };
    return { color: "orange", emoji: "⚪", label: cls || "Prueba inconclusa" };
  };

  const buildCriticalTraces = (points) => {
    // Comentario: Crea trazas separadas por tipo, todas simultáneas, con etiquetas
    const groups = { minimo: [], maximo: [], silla: [], otro: [] };
    for (const p of points) {
      const cls = (p.classification || "").toLowerCase();
      const item = { x: p.x, y: p.y, z: Number(p.f), cls: p.classification };
      if (cls.includes("mínimo")) groups.minimo.push(item);
      else if (cls.includes("máximo")) groups.maximo.push(item);
      else if (cls.includes("silla")) groups.silla.push(item);
      else groups.otro.push(item);
    }
    const mkTrace = (arr, style, name) => arr.length === 0 ? null : {
      type: "scatter3d",
      mode: "markers+text",
      x: arr.map(a => a.x),
      y: arr.map(a => a.y),
      z: arr.map(a => a.z),
      marker: { color: style.color, size: 1 },
      text: arr.map(a => `${style.emoji} ${style.label}`),
      textposition: "top center",
      name,
    };
    const tMin = mkTrace(groups.minimo, { color: "red", emoji: "🔴", label: "Mínimo local" }, "Mínimos locales");
    const tMax = mkTrace(groups.maximo, { color: "green", emoji: "🟢", label: "Máximos locales" }, "Máximos locales");
    const tSaddle = mkTrace(groups.silla, { color: "gold", emoji: "🟡", label: "Puntos de silla" }, "Puntos de silla");
    const tOther = mkTrace(groups.otro, { color: "orange", emoji: "⚪", label: "Prueba inconclusa" }, "Prueba inconclusa");
    return [tMin, tMax, tSaddle, tOther].filter(Boolean);
  };

  const pulseTraces = (traceIndices) => {
    // Comentario: Efecto "pop" incrementando y reduciendo el tamaño del marcador
    try {
      traceIndices.forEach(idx => window.Plotly.restyle(graphDiv, { 'marker.size': [1] }, [idx]));
      setTimeout(() => {
        traceIndices.forEach(idx => window.Plotly.restyle(graphDiv, { 'marker.size': [10], 'marker.opacity': [0.95] }, [idx]));
      }, 60);
      setTimeout(() => {
        traceIndices.forEach(idx => window.Plotly.restyle(graphDiv, { 'marker.size': [6], 'marker.opacity': [1] }, [idx]));
      }, 280);
    } catch (_) { /* sin romper la UI */ }
  };
  if (window.BACKEND_AVAILABLE) {
    try {
      const data = await postJSON("/optimize", { expression: normalizeExpressionForBackend(expr) });
      if (data && data.error) throw new Error(data.error);
      const cp = Array.isArray(data.critical_points) ? data.critical_points : [];
      const texExpr = (() => { try { const node = math.parse(normalizeExpressionForLocal(expr)); return node.toTex({ parenthesis: 'auto', implicit: 'hide' }); } catch { return expr; } })();
      resultsBox.innerHTML = `
        <div class="result-card result-card--optimize animate-fade">
          <h3>Optimización sin restricciones</h3>
          <p>Función:</p>
          <div class="math-expression">${ensureBlockLatex(texExpr)}</div>
          ${data.gradient_latex ? `<p>Gradiente:</p><div class="math-expression">${ensureBlockLatex(data.gradient_latex)}</div>` : ''}
        </div>
        <div class="result-card result-card--optimize">
          <h3>Puntos críticos</h3>
          ${cp.length === 0 ? `<p>⚠️ No se encontraron puntos críticos en el dominio de la función.</p>` : `
            <ul>
              ${cp.map(p => {
                const s = classStyle(p.classification);
            return `<li class="math-expression">\\(x=${Number(p.x).toFixed(4)},\, y=${Number(p.y).toFixed(4)}\\) → \\(f=${Number(p.f).toFixed(4)}\\) <span style="color:${s.color}">${s.emoji} ${s.label}</span></li>`;
              }).join('')}
            </ul>
          `}
        </div>
        <div class="summary-card animate-fade">
          <div class="summary-title">Interpretación</div>
          <p>Se iguala el gradiente a cero para hallar puntos críticos y se analiza la Hessiana para clasificarlos como máximos, mínimos o de silla.</p>
        </div>
      `;
      // Envolver matemáticas inline dentro del texto explicativo
      const wrapInline = (t) => {
        if (typeof t !== 'string') return '';
        let s = t;
        // Eliminar delimitadores inline preexistentes para evitar anidación y errores
        s = s.replace(/\\\(|\\\)/g, '');
        // Reemplazos principales
        s = s.replace(/∇f\s*=\s*0/g, '\\(\\nabla f = 0\\)');
        s = s.replace(/∇f/g, '\\(\\nabla f\\)');
        // Capturar la expresión de D completa hasta punto o punto y coma,
        // y limpiar delimitadores inline internos para evitar anidación.
        s = s.replace(/D\s*=\s*([^.;]+)/g, (m, expr) => {
          const inner = expr.trim().replace(/\\\(|\\\)/g, '');
          return `\\(D = ${inner}\\)`;
        });
        s = s.replace(/D\s*>\s*0/g, '\\(D > 0\\)');
        s = s.replace(/D\s*<\s*0/g, '\\(D < 0\\)');
        s = s.replace(/D\s*=\s*0/g, '\\(D = 0\\)');
        // Envolver comparaciones con f_{xx}
        s = s.replace(/f_\{xx\}\s*>\s*0/g, '\\(f_{xx} > 0\\)');
        s = s.replace(/f_\{xx\}\s*<\s*0/g, '\\(f_{xx} < 0\\)');
        // Normalizar posibles duplicados de delimitadores generados
        s = s.replace(/\\\(\s*\\\(/g, '\\(');
        s = s.replace(/\\\)\s*\\\)/g, '\\)');
        s = s.replace(/\\\(\(/g, '\\(');
        s = s.replace(/\)\\\)/g, '\\)');
        // No envolver f_{..} si ya están dentro de fórmulas envueltas
        return s;
      };

      stepsBox.innerHTML = `
        <div class="result-card explanation-box">
          <h3>🧠 Explicación paso a paso</h3>
          <ol>
            <li>1️⃣ Se calcula el gradiente</li>
            <div class="math-expression">${ensureBlockLatex('\\nabla f = (\\partial f/\\partial x,\\; \\partial f/\\partial y)')}</div>
            <li>2️⃣ Se resuelve para puntos críticos</li>
            <div class="math-expression">${ensureBlockLatex('\\nabla f = 0')}</div>
            <li>3️⃣ Se obtiene la matriz Hessiana</li>
            <div class="math-expression">${ensureBlockLatex('H = \\begin{pmatrix} f_{xx} & f_{xy} \\\\ f_{yx} & f_{yy} \\end{pmatrix}')}</div>
            <li>4️⃣ Se analiza el determinante y el signo de \(f_{xx}\)</li>
            <div class="math-expression">${ensureBlockLatex('D = f_{xx} f_{yy} - f_{xy}^{2}')}</div>
          </ol>
          ${data.explanation ? `<p class="math-expression">${wrapInline(data.explanation)}</p>` : ''}
        </div>
      `;
      // Migrado a KaTeX
      renderMathAll([resultsBox, stepsBox]);
      await draw3DGraph(expr);
      if (cp.length > 0 && window.Plotly && graphDiv) {
        const baseLen = (graphDiv.data || []).length;
        const traces = buildCriticalTraces(cp);
        window.Plotly.addTraces(graphDiv, traces).then(() => {
          const idxs = traces.map((_, i) => baseLen + i);
          pulseTraces(idxs);
        }).catch(() => {});
      }
      return;
    } catch (err) {
      showError("Backend no disponible para optimización. Usando modo local.");
    }
  }
  // Fallback local
  try {
    const cps = findCriticalPointsLocal(expr);
    const texExpr = (() => { try { const node = math.parse(normalizeExpressionForLocal(expr)); return node.toTex({ parenthesis: 'auto', implicit: 'hide' }); } catch { return expr; } })();
    resultsBox.innerHTML = `
      <div class="result-card result-card--optimize animate-fade">
        <h3>Optimización sin restricciones (modo local)</h3>
        <p>Función:</p>
        <div class="math-expression">${ensureBlockLatex(texExpr)}</div>
      </div>
      <div class="result-card result-card--optimize">
        <h3>Puntos críticos</h3>
        ${cps.length === 0 ? `<p>⚠️ No se encontraron puntos críticos en el dominio de la función.</p>` : `
          <ul>
            ${cps.map(p => {
              const s = classStyle(p.classification);
              return `<li class="math-expression">\\(x=${Number(p.x).toFixed(4)},\, y=${Number(p.y).toFixed(4)}\\) → \\(f=${Number(p.f).toFixed(4)}\\) <span style="color:${s.color}">${s.emoji} ${s.label}</span></li>`;
            }).join('')}
          </ul>
        `}
        <p>Clasificación aproximada por la prueba de la segunda derivada.</p>
      </div>
      <div class="summary-card animate-fade">
        <div class="summary-title">Interpretación</div>
        <p>Se resuelve \(\nabla f = 0\) y se usa la Hessiana para clasificar los puntos encontrados.</p>
      </div>
    `;
    renderMathAll([resultsBox]);
    stepsBox.innerHTML = `
      <div class="result-card explanation-box">
        <h3>🧠 Explicación paso a paso</h3>
        <ol>
          <li>1️⃣ Se calcula el gradiente</li>
          <div class="math-expression">${ensureBlockLatex('\\nabla f = (\\partial f/\\partial x,\\; \\partial f/\\partial y)')}</div>
          <li>2️⃣ Se resuelve \(\nabla f = 0\) para encontrar los puntos críticos.</li>
          <li>3️⃣ Se obtiene la matriz Hessiana \(H = \begin{pmatrix} f_{xx} & f_{xy} \\ f_{yx} & f_{yy} \end{pmatrix} \).</li>
          <li>4️⃣ Se analiza el determinante \(D = f_{xx}f_{yy} - f_{xy}^2\) y \(f_{xx}\) para clasificar cada punto.</li>
        </ol>
      </div>
    `;
    // Migrado a KaTeX
    renderMathAll([resultsBox, stepsBox]);
    await draw3DGraph(expr);
    if (cps.length > 0 && window.Plotly && graphDiv) {
      const baseLen = (graphDiv.data || []).length;
      const traces = buildCriticalTraces(cps);
      window.Plotly.addTraces(graphDiv, traces).then(() => {
        const idxs = traces.map((_, i) => baseLen + i);
        pulseTraces(idxs);
      }).catch(() => {});
    }
  } catch (err) {
    showError("No se pudo completar la optimización local.");
  }
}

// Registro de eventos en los botones
btnPartials?.addEventListener("click", getPartials);
btnGradient?.addEventListener("click", getGradient);
btnEvaluate?.addEventListener("click", evaluateFunction);
btnDoubleIntegral?.addEventListener("click", getDoubleIntegral);
btnLagrange?.addEventListener("click", getLagrange);
btnOptimize?.addEventListener("click", optimizeFunction);
btnAnalyzeDomain?.addEventListener("click", analyzeDomainRange);

// Inicialización: comprueba el backend al cargar la página
pingBackend();
// Las librerías (Plotly, Math.js) se cargan de forma estática en el HTML.

// =====================================
// Renderizado de pasos y explicación
// =====================================
function renderSteps(stepsOrData, containerId = 'stepCard') {
  // Soporta antiguo formato {steps, explanation} y nuevo array de pasos detallados
  const container = document.getElementById(containerId) || stepsBox;
  if (!container) return;
  let steps = [];
  let summary = '';
  let explanationDetailed = '';
  if (Array.isArray(stepsOrData)) {
    steps = stepsOrData;
  } else if (stepsOrData && typeof stepsOrData === 'object') {
    steps = Array.isArray(stepsOrData.steps) ? stepsOrData.steps : [];
    summary = typeof stepsOrData.summary === 'string' ? stepsOrData.summary : '';
    explanationDetailed = typeof stepsOrData.explanation_detailed === 'string' ? stepsOrData.explanation_detailed : '';
  }
  if (!steps.length && !summary) { container.innerHTML = ''; return; }

  // Construir tarjeta moderna de pasos
  const itemsHtml = steps.map((s, idx) => {
    if (typeof s === 'string') {
      // Compatibilidad: paso como string
      return `<li>${sanitizeLatex(s)}</li>`;
    }
    const numEmoji = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'][idx] || `${idx+1}.`;
    const title = s.title ? `<h4>${numEmoji} ${s.title}</h4>` : `<h4>${numEmoji} Paso ${idx+1}</h4>`;
    const latex = s.latex ? `<div class="math-expression">${ensureBlockLatex(s.latex)}</div>` : '';
    const expl = s.explanation ? `<p>${sanitizeLatex(s.explanation)}</p>` : '';
    const more = s.longLatex || s.details ? `<button class="see-more-btn" data-long="${encodeURIComponent(s.longLatex || s.details)}">Ver más 📘</button>` : '';
    return `<li>${title}${latex}${expl}${more}</li>`;
  }).join('');

  const summaryHtml = summary ? `
    <div class="summary-card animate-fade">
      <div class="summary-title">Resumen</div>
      <p>${summary}</p>
    </div>` : '';

  const html = `
    <div class="result-card animate-fade">
      <h3>🧩 Proceso paso a paso</h3>
      <ul>${itemsHtml}</ul>
      ${summaryHtml}
    </div>
  `;
  const cid = container.id || 'process';
  updateMathContainer(cid, html);

  // Gestionar modales de "Ver más"
  container.querySelectorAll('.see-more-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const payload = btn.getAttribute('data-long') || '';
      const longHtml = decodeURIComponent(payload);
      const modal = document.createElement('div');
      modal.classList.add('modal');
      modal.innerHTML = `
        <div class="modal-content">
          <h2>🧠 Explicación detallada</h2>
          <p class="modal-body">${longHtml || 'Sin contenido adicional'}</p>
          <button id="closeModal" class="close-modal">Cerrar</button>
        </div>
      `;
      document.body.appendChild(modal);
      renderMathAll([modal]);
      const closeBtn = document.getElementById('closeModal');
      closeBtn?.addEventListener('click', () => modal.remove());
      modal.addEventListener('click', (ev) => { if (ev.target === modal) modal.remove(); });
    });
  });
}

// =====================================
// Teclado matemático interactivo
// =====================================
// Teclado matemático universal: funciona en todos los campos relevantes
// Comentario: Inserta símbolos en el input que tenga el foco activo
(function initMathKeyboard(){
  const kb = document.getElementById("math-keyboard");
  if (!kb) return;

  // Campos que aceptan expresiones o valores matemáticos
  const candidates = [
    document.getElementById("function") || document.getElementById("expression"),
    document.getElementById("constraint"),
    document.getElementById("x0"),
    document.getElementById("y0"),
    document.getElementById("xStart"),
    document.getElementById("xEnd"),
    document.getElementById("yStart"),
    document.getElementById("yEnd"),
  ].filter(Boolean);

  let activeInput = candidates[0] || null;
  // Actualiza el campo activo al enfocar o hacer clic
  candidates.forEach((el) => {
    el.addEventListener("focus", () => { activeInput = el; });
    el.addEventListener("click", () => { activeInput = el; });
  });

  kb.addEventListener("click", (e) => {
    const btn = e.target.closest(".kb-btn");
    if (!btn) return;
    const insert = btn.getAttribute("data-insert") || "";

    // Si no hay campo activo, usa el de función
    if (!activeInput) {
      activeInput = document.getElementById("function") || document.getElementById("expression");
      if (!activeInput) return;
    }

    // Inserta en la posición del cursor del campo activo
    const start = activeInput.selectionStart ?? activeInput.value.length;
    const end = activeInput.selectionEnd ?? activeInput.value.length;
    const before = activeInput.value.slice(0, start);
    const after = activeInput.value.slice(end);
    activeInput.value = before + insert + after;

    // Coloca el cursor dentro de los paréntesis si aplica
    const newPos = insert.endsWith("()") ? start + insert.length - 1 : start + insert.length;
    try { activeInput.setSelectionRange(newPos, newPos); } catch {}
    activeInput.focus();
  });
})();

// Fallback: asegurar render global KaTeX al cargar por si el auto-render inicial falla
window.addEventListener('load', function(){
  try { renderMathAll([document.body]); } catch(_) {}
});