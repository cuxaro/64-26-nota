(() => {
  'use strict';

  const DEFAULTS = Object.freeze({
    correct: 63,
    wrong: 23,
    blank: 4,
    annulled: 3,
    penalty: 3,
    scale: 60,
  });

  const form = document.getElementById('calculatorForm');
  const correctInput = document.getElementById('correctInput');
  const wrongInput = document.getElementById('wrongInput');
  const blankInput = document.getElementById('blankInput');
  const annulledInput = document.getElementById('annulledInput');
  const penaltyInput = document.getElementById('penaltyInput');
  const scaleInput = document.getElementById('scaleInput');
  const resetButton = document.getElementById('resetButton');
  const exportButton = document.getElementById('exportButton');
  const formError = document.getElementById('formError');
  const resultsBody = document.getElementById('resultsBody');
  const totalBadge = document.getElementById('totalBadge');
  const currentScoreElement = document.getElementById('currentScore');
  const currentFormulaElement = document.getElementById('currentFormula');
  const validQuestionsElement = document.getElementById('validQuestions');
  const annulledSummaryElement = document.getElementById('annulledSummary');
  const combinationCountElement = document.getElementById('combinationCount');
  const resultsDescription = document.getElementById('resultsDescription');

  let currentRows = [];
  let currentConfig = null;

  const numberFormatter = new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  function formatNumber(value) {
    return numberFormatter.format(value);
  }

  function formatVariation(value) {
    if (Math.abs(value) < 0.005) return '0,00';
    return `${value > 0 ? '+' : '−'}${formatNumber(Math.abs(value))}`;
  }

  function readInteger(input, label) {
    const raw = input.value.trim();
    const value = Number(raw);
    if (raw === '' || !Number.isInteger(value) || value < 0) {
      throw new Error(`${label} debe ser un número entero igual o mayor que 0.`);
    }
    return value;
  }

  function readPositiveNumber(input, label) {
    const raw = input.value.trim().replace(',', '.');
    const value = Number(raw);
    if (raw === '' || !Number.isFinite(value) || value <= 0) {
      throw new Error(`${label} debe ser un número mayor que 0.`);
    }
    return value;
  }

  function getConfig() {
    const correct = readInteger(correctInput, 'Las preguntas bien');
    const wrong = readInteger(wrongInput, 'Las preguntas mal');
    const blank = readInteger(blankInput, 'Las preguntas en blanco');
    const annulled = readInteger(annulledInput, 'El número de impugnadas');
    const penalty = readPositiveNumber(penaltyInput, 'La penalización');
    const scale = readPositiveNumber(scaleInput, 'La nota máxima');
    const total = correct + wrong + blank;

    if (total === 0) {
      throw new Error('El examen debe tener al menos una pregunta.');
    }
    if (annulled >= total) {
      throw new Error('Las preguntas impugnadas deben ser menos que el total del examen.');
    }
    if (annulled > 50) {
      throw new Error('La calculadora admite hasta 50 preguntas impugnadas por cálculo.');
    }

    return { correct, wrong, blank, annulled, penalty, scale, total };
  }

  function calculateScore(correct, wrong, total, penalty, scale) {
    const net = correct - wrong / penalty;
    const score = (net / total) * scale;
    return { net, score };
  }

  function generateCombinations(config) {
    const rows = [];
    const current = calculateScore(
      config.correct,
      config.wrong,
      config.total,
      config.penalty,
      config.scale,
    );
    const validTotal = config.total - config.annulled;

    for (let annulledCorrect = Math.min(config.annulled, config.correct); annulledCorrect >= 0; annulledCorrect -= 1) {
      const remainingAfterCorrect = config.annulled - annulledCorrect;
      const maxWrong = Math.min(remainingAfterCorrect, config.wrong);

      for (let annulledWrong = maxWrong; annulledWrong >= 0; annulledWrong -= 1) {
        const annulledBlank = remainingAfterCorrect - annulledWrong;
        if (annulledBlank < 0 || annulledBlank > config.blank) continue;

        const remainingCorrect = config.correct - annulledCorrect;
        const remainingWrong = config.wrong - annulledWrong;
        const remainingBlank = config.blank - annulledBlank;
        const recalculated = calculateScore(
          remainingCorrect,
          remainingWrong,
          validTotal,
          config.penalty,
          config.scale,
        );

        rows.push({
          annulledCorrect,
          annulledWrong,
          annulledBlank,
          remainingCorrect,
          remainingWrong,
          remainingBlank,
          validTotal,
          net: recalculated.net,
          score: recalculated.score,
          variation: recalculated.score - current.score,
        });
      }
    }

    return { rows, current };
  }

  function createCell(value, className = '') {
    const cell = document.createElement('td');
    cell.textContent = String(value);
    if (className) cell.className = className;
    return cell;
  }

  function renderRows(rows) {
    resultsBody.replaceChildren();
    const fragment = document.createDocumentFragment();

    rows.forEach((row) => {
      const tr = document.createElement('tr');
      if (row.variation > 0.005) tr.className = 'is-positive';
      else if (row.variation < -0.005) tr.className = 'is-negative';
      else tr.className = 'is-neutral';

      tr.append(
        createCell(row.annulledCorrect),
        createCell(row.annulledWrong),
        createCell(row.annulledBlank),
        createCell(row.remainingCorrect),
        createCell(row.remainingWrong),
        createCell(row.remainingBlank),
        createCell(row.validTotal),
        createCell(formatNumber(row.net)),
        createCell(formatNumber(row.score), 'score'),
        createCell(formatVariation(row.variation), 'variation'),
      );
      fragment.appendChild(tr);
    });

    resultsBody.appendChild(fragment);
  }

  function renderSummary(config, current, rowCount) {
    totalBadge.textContent = `${config.total} ${config.total === 1 ? 'pregunta' : 'preguntas'}`;
    currentScoreElement.textContent = formatNumber(current.score);
    currentFormulaElement.textContent = `${formatNumber(current.net)} puntos netos de ${config.total}`;
    validQuestionsElement.textContent = String(config.total - config.annulled);
    annulledSummaryElement.textContent = `${config.annulled} ${config.annulled === 1 ? 'pregunta eliminada' : 'preguntas eliminadas'}`;
    combinationCountElement.textContent = String(rowCount);
    resultsDescription.textContent = `${rowCount} ${rowCount === 1 ? 'combinación posible' : 'combinaciones posibles'} con ${config.annulled} ${config.annulled === 1 ? 'impugnación' : 'impugnaciones'}.`;
  }

  function showError(message) {
    formError.textContent = message;
    formError.hidden = false;
    exportButton.disabled = true;
  }

  function clearError() {
    formError.textContent = '';
    formError.hidden = true;
  }

  function updateUrl(config) {
    const params = new URLSearchParams({
      bien: String(config.correct),
      mal: String(config.wrong),
      blanco: String(config.blank),
      impugnadas: String(config.annulled),
      penalizacion: String(config.penalty),
      escala: String(config.scale),
    });
    history.replaceState(null, '', `${location.pathname}?${params.toString()}`);
  }

  function calculate({ updateHistory = true } = {}) {
    clearError();
    try {
      const config = getConfig();
      const { rows, current } = generateCombinations(config);
      if (rows.length === 0) {
        throw new Error('No existe ninguna combinación válida con esos datos.');
      }

      currentRows = rows;
      currentConfig = config;
      renderRows(rows);
      renderSummary(config, current, rows.length);
      exportButton.disabled = false;
      if (updateHistory) updateUrl(config);
    } catch (error) {
      currentRows = [];
      currentConfig = null;
      resultsBody.replaceChildren();
      showError(error instanceof Error ? error.message : 'No se ha podido realizar el cálculo.');
    }
  }

  function setValues(values) {
    correctInput.value = values.correct;
    wrongInput.value = values.wrong;
    blankInput.value = values.blank;
    annulledInput.value = values.annulled;
    penaltyInput.value = values.penalty;
    scaleInput.value = values.scale;
  }

  function loadFromUrl() {
    const params = new URLSearchParams(location.search);
    if (!params.size) return;

    const candidate = {
      correct: params.get('bien') ?? DEFAULTS.correct,
      wrong: params.get('mal') ?? DEFAULTS.wrong,
      blank: params.get('blanco') ?? DEFAULTS.blank,
      annulled: params.get('impugnadas') ?? DEFAULTS.annulled,
      penalty: params.get('penalizacion') ?? DEFAULTS.penalty,
      scale: params.get('escala') ?? DEFAULTS.scale,
    };
    setValues(candidate);
  }

  function csvEscape(value) {
    const text = String(value).replaceAll('"', '""');
    return `"${text}"`;
  }

  function exportCsv() {
    if (!currentConfig || currentRows.length === 0) return;

    const headers = [
      'Impugnadas bien',
      'Impugnadas mal',
      'Impugnadas en blanco',
      'Bien restantes',
      'Mal restantes',
      'Blanco restantes',
      'Preguntas válidas',
      'Puntos netos',
      'Nota nueva',
      'Variación',
    ];

    const lines = [headers.map(csvEscape).join(';')];
    currentRows.forEach((row) => {
      lines.push([
        row.annulledCorrect,
        row.annulledWrong,
        row.annulledBlank,
        row.remainingCorrect,
        row.remainingWrong,
        row.remainingBlank,
        row.validTotal,
        formatNumber(row.net),
        formatNumber(row.score),
        formatVariation(row.variation),
      ].map(csvEscape).join(';'));
    });

    const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `impugnaciones-${currentConfig.annulled}-${currentConfig.total}-preguntas.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    calculate();
  });

  resetButton.addEventListener('click', () => {
    setValues(DEFAULTS);
    calculate();
  });

  exportButton.addEventListener('click', exportCsv);

  [correctInput, wrongInput, blankInput].forEach((input) => {
    input.addEventListener('input', () => {
      const total = [correctInput, wrongInput, blankInput]
        .map((element) => Number(element.value))
        .filter(Number.isFinite)
        .reduce((sum, value) => sum + value, 0);
      totalBadge.textContent = `${total} ${total === 1 ? 'pregunta' : 'preguntas'}`;
    });
  });

  loadFromUrl();
  calculate({ updateHistory: false });
})();