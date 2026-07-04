const DEFAULT_DATA_URL = "data/respuestas.json";
const STORAGE_KEY_PREFIX = "calculadora-oposicion-respuestas-v1";

const state = {
  data: null,
  answers: {},
  lastResult: null
};

const els = {
  dataStatus: document.querySelector("#dataStatus"),
  platformSelect: document.querySelector("#platformSelect"),
  scaleSelect: document.querySelector("#scaleSelect"),
  calculateBtn: document.querySelector("#calculateBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  exportBtn: document.querySelector("#exportBtn"),
  bulkInput: document.querySelector("#bulkInput"),
  applyBulkBtn: document.querySelector("#applyBulkBtn"),
  dataFileInput: document.querySelector("#dataFileInput"),
  questionsGrid: document.querySelector("#questionsGrid"),
  questionTemplate: document.querySelector("#questionTemplate"),
  questionCount: document.querySelector("#questionCount"),
  mainScore: document.querySelector("#mainScore"),
  scoreLabel: document.querySelector("#scoreLabel"),
  correctCount: document.querySelector("#correctCount"),
  wrongCount: document.querySelector("#wrongCount"),
  blankCount: document.querySelector("#blankCount"),
  rawScore: document.querySelector("#rawScore"),
  resultNote: document.querySelector("#resultNote")
};

document.addEventListener("DOMContentLoaded", init);

async function init() {
  bindEvents();
  try {
    const response = await fetch(DEFAULT_DATA_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`No se pudo cargar ${DEFAULT_DATA_URL}`);
    const data = await response.json();
    loadData(normalizeData(data), "Correcciones cargadas");
  } catch (error) {
    console.error(error);
    els.dataStatus.textContent = "Carga un JSON o CSV";
    els.resultNote.textContent = "No se pudo cargar el archivo de respuestas por defecto. Puedes cargar uno manualmente.";
  }
}

function bindEvents() {
  els.calculateBtn.addEventListener("click", calculateAndRender);
  els.resetBtn.addEventListener("click", resetAnswers);
  els.exportBtn.addEventListener("click", exportResults);
  els.applyBulkBtn.addEventListener("click", applyBulkAnswers);
  els.platformSelect.addEventListener("change", () => {
    calculateAndRender();
    renderQuestions();
  });
  els.scaleSelect.addEventListener("change", renderScoreOnly);
  els.dataFileInput.addEventListener("change", loadDataFile);
}

function loadData(data, message = "Correcciones cargadas") {
  state.data = data;
  state.answers = loadSavedAnswers(data.titulo) || {};
  state.lastResult = null;

  renderPlatformSelect();
  renderQuestions();
  renderEmptyResult();

  els.dataStatus.textContent = message;
  els.questionCount.textContent = `${data.preguntas.length} preguntas`;
}

function normalizeData(raw) {
  const preguntas = raw.preguntas || raw.questions || [];
  if (!Array.isArray(preguntas) || preguntas.length === 0) {
    throw new Error("El archivo no contiene preguntas.");
  }

  const normalizedQuestions = preguntas
    .map((row, index) => {
      const numero = Number(row.numero ?? row.n ?? row["Nº"] ?? row["N"] ?? index + 1);
      const clean = { numero };
      Object.entries(row).forEach(([key, value]) => {
        if (["numero", "n", "Nº", "N", "respuesta", "Respuesta"].includes(key)) return;
        if (value === null || value === undefined || value === "") return;
        clean[key.trim()] = normalizeAnswer(value);
      });
      return clean;
    })
    .filter(row => Number.isFinite(row.numero));

  const platforms = Array.from(
    new Set(normalizedQuestions.flatMap(q => Object.keys(q).filter(key => key !== "numero")))
  );

  if (platforms.length === 0) {
    throw new Error("No se han encontrado columnas de corrección.");
  }

  return {
    titulo: raw.titulo || raw.title || "Calculadora",
    descripcion: raw.descripcion || raw.description || "",
    opciones: raw.opciones || raw.options || ["A", "B", "C", "D"],
    penalizacion: Number(raw.penalizacion ?? raw.penalty ?? 1 / 3),
    preguntas: normalizedQuestions,
    plataformas: raw.plataformas || raw.platforms || platforms
  };
}

function renderPlatformSelect() {
  const platforms = state.data.plataformas.filter(name =>
    state.data.preguntas.some(q => q[name])
  );

  els.platformSelect.innerHTML = platforms
    .map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`)
    .join("");
}

function renderQuestions() {
  if (!state.data) return;
  const platform = els.platformSelect.value;
  els.questionsGrid.innerHTML = "";

  state.data.preguntas.forEach(question => {
    const node = els.questionTemplate.content.firstElementChild.cloneNode(true);
    node.dataset.question = question.numero;
    node.querySelector(".question-number").textContent = `Pregunta ${question.numero}`;

    const options = node.querySelector(".options");
    const selected = state.answers[question.numero] || "";
    const correct = question[platform];

    [...state.data.opciones, "-"].forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "option";
      button.textContent = option === "-" ? "—" : option;
      button.setAttribute("aria-label", `Pregunta ${question.numero}: ${option === "-" ? "en blanco" : option}`);
      button.dataset.answer = option;

      if (selected === option) button.classList.add("selected");
      if (state.lastResult && selected === option) {
        if (selected === "-") {
          // En blanco: no marcamos como fallo.
        } else if (selected === correct) {
          button.classList.add("correct");
        } else {
          button.classList.add("wrong");
        }
      }

      button.addEventListener("click", () => {
        state.answers[question.numero] = option;
        saveAnswers();
        state.lastResult = null;
        renderQuestions();
        renderEmptyResult("Pulsa “Calcular nota” para actualizar el resultado.");
      });

      options.appendChild(button);
    });

    els.questionsGrid.appendChild(node);
  });
}

function calculate() {
  if (!state.data) return null;

  const platform = els.platformSelect.value;
  const penalty = Number(state.data.penalizacion || 1 / 3);
  let correct = 0;
  let wrong = 0;
  let blank = 0;
  const details = [];

  state.data.preguntas.forEach(question => {
    const userAnswer = normalizeAnswer(state.answers[question.numero] || "-");
    const correctAnswer = normalizeAnswer(question[platform]);

    let status = "blank";
    if (!userAnswer || userAnswer === "-") {
      blank += 1;
    } else if (userAnswer === correctAnswer) {
      correct += 1;
      status = "correct";
    } else {
      wrong += 1;
      status = "wrong";
    }

    details.push({
      numero: question.numero,
      respuesta: userAnswer || "-",
      correcta: correctAnswer,
      estado: status
    });
  });

  const total = state.data.preguntas.length;
  const rawScore = correct - wrong * penalty;

  return {
    platform,
    total,
    correct,
    wrong,
    blank,
    penalty,
    rawScore,
    score10: total ? (rawScore / total) * 10 : 0,
    score60: total ? (rawScore / total) * 60 : 0,
    details
  };
}

function calculateAndRender() {
  state.lastResult = calculate();
  renderResult(state.lastResult);
  renderQuestions();
}

function renderScoreOnly() {
  if (!state.lastResult) {
    renderEmptyResult();
    return;
  }
  renderResult(state.lastResult);
}

function renderResult(result) {
  if (!result) return;

  const scale = Number(els.scaleSelect.value);
  const score = scale === 60 ? result.score60 : result.score10;

  els.scoreLabel.textContent = `Nota sobre ${scale}`;
  els.mainScore.textContent = formatNumber(score, 3);
  els.correctCount.textContent = result.correct;
  els.wrongCount.textContent = result.wrong;
  els.blankCount.textContent = result.blank;
  els.rawScore.textContent = formatNumber(result.rawScore, 3);
  els.resultNote.textContent =
    `Corrección: ${result.platform}. Fórmula: aciertos - fallos × ${formatNumber(result.penalty, 3)}.`;
}

function renderEmptyResult(note = "La nota se actualizará al calcular.") {
  els.scoreLabel.textContent = `Nota sobre ${els.scaleSelect.value}`;
  els.mainScore.textContent = "—";
  els.correctCount.textContent = "—";
  els.wrongCount.textContent = "—";
  els.blankCount.textContent = "—";
  els.rawScore.textContent = "—";
  els.resultNote.textContent = note;
}

function resetAnswers() {
  if (!state.data) return;
  const ok = window.confirm("¿Seguro que quieres limpiar todas las respuestas?");
  if (!ok) return;
  state.answers = {};
  state.lastResult = null;
  saveAnswers();
  renderQuestions();
  renderEmptyResult("Respuestas limpiadas.");
}

function applyBulkAnswers() {
  if (!state.data) return;

  const parsed = parseBulkAnswers(els.bulkInput.value, state.data.preguntas.length);
  if (parsed.length === 0) {
    alert("No he encontrado respuestas válidas. Usa A, B, C, D o -.");
    return;
  }

  state.data.preguntas.forEach((question, index) => {
    state.answers[question.numero] = parsed[index] || "-";
  });

  saveAnswers();
  state.lastResult = null;
  renderQuestions();
  renderEmptyResult("Respuestas pegadas. Pulsa “Calcular nota” para ver la nota.");
}

function parseBulkAnswers(text, expectedLength) {
  const cleaned = text.trim().toUpperCase();
  if (!cleaned) return [];

  const separated = cleaned
    .split(/[\s,;|]+/)
    .map(normalizeAnswer)
    .filter(value => value);

  if (separated.length > 1) {
    return separated.slice(0, expectedLength);
  }

  return Array.from(cleaned)
    .map(char => (char === "_" || char === "0" ? "-" : char))
    .filter(char => ["A", "B", "C", "D", "-"].includes(char))
    .slice(0, expectedLength);
}

function normalizeAnswer(value) {
  if (value === null || value === undefined) return "";
  const text = String(value).trim().toUpperCase();
  if (!text || text === "—" || text === "_" || text === "0" || text === "BLANCO" || text === "NC") return "-";
  return text[0];
}

async function loadDataFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    let data;
    if (file.name.toLowerCase().endsWith(".csv")) {
      data = csvToData(text, file.name.replace(/\.csv$/i, ""));
    } else {
      data = JSON.parse(text);
    }
    loadData(normalizeData(data), `Cargado: ${file.name}`);
  } catch (error) {
    console.error(error);
    alert(`No se pudo cargar el archivo: ${error.message}`);
  } finally {
    event.target.value = "";
  }
}

function csvToData(text, title = "Correcciones CSV") {
  const rows = parseCSV(text);
  if (rows.length < 2) throw new Error("El CSV está vacío.");

  const headers = rows[0].map(header => header.trim());
  const dataRows = rows.slice(1).filter(row => row.some(cell => cell.trim() !== ""));

  const preguntas = dataRows.map((row, index) => {
    const item = {};
    headers.forEach((header, colIndex) => {
      const value = row[colIndex] ?? "";
      if (/^(numero|n|nº|pregunta)$/i.test(header)) {
        item.numero = Number(value || index + 1);
      } else if (!/respuesta/i.test(header)) {
        item[header] = value;
      }
    });
    if (!item.numero) item.numero = index + 1;
    return item;
  });

  return {
    titulo: title,
    penalizacion: 1 / 3,
    opciones: ["A", "B", "C", "D"],
    preguntas
  };
}

function parseCSV(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && insideQuotes && next === '"') {
      cell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === "," && !insideQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell);
  rows.push(row);
  return rows;
}

function exportResults() {
  if (!state.data) return;
  const result = state.lastResult || calculate();
  if (!result) return;

  const headers = ["numero", "respuesta", "correcta", "estado"];
  const lines = [
    ["plataforma", result.platform],
    ["aciertos", result.correct],
    ["fallos", result.wrong],
    ["no_contestadas", result.blank],
    ["puntuacion_neta", result.rawScore],
    ["nota_sobre_10", result.score10],
    ["nota_sobre_60", result.score60],
    [],
    headers
  ];

  result.details.forEach(item => {
    lines.push([item.numero, item.respuesta, item.correcta, item.estado]);
  });

  const csv = lines.map(row =>
    row.map(value => csvEscape(value)).join(",")
  ).join("\n");

  downloadText(csv, `resultado-${slugify(state.data.titulo)}-${slugify(result.platform)}.csv`, "text/csv;charset=utf-8");
}

function saveAnswers() {
  if (!state.data) return;
  localStorage.setItem(storageKey(state.data.titulo), JSON.stringify(state.answers));
}

function loadSavedAnswers(title) {
  try {
    return JSON.parse(localStorage.getItem(storageKey(title)) || "{}");
  } catch {
    return {};
  }
}

function storageKey(title) {
  return `${STORAGE_KEY_PREFIX}-${slugify(title)}`;
}

function formatNumber(value, decimals = 2) {
  return new Intl.NumberFormat("es-ES", {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals
  }).format(value);
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;"
  }[char]));
}

function csvEscape(value) {
  const text = String(value ?? "");
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadText(text, filename, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function slugify(value) {
  return String(value || "archivo")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}