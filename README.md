# Calculadora de nota

Web estática para calcular una nota a partir de respuestas tipo test.

## Qué hace

- Carga las correcciones desde `data/respuestas.json`.
- Permite elegir la corrección de `ChatGPT`, `Gemini` o `ConsigueTuOpo`.
- Permite marcar respuestas A/B/C/D o dejar en blanco.
- Calcula:
  - acertadas
  - falladas
  - no contestadas
  - puntuación neta: `aciertos - fallos × 1/3`
  - nota sobre 10
  - nota sobre 60
- Permite pegar respuestas en bloque.
- Permite cargar otro JSON o CSV en el navegador para probar nuevas plantillas.
- Permite exportar resultados a CSV.

## Publicarlo en GitHub Pages

1. Crea un repositorio público en GitHub.
2. Sube todos estos archivos a la raíz del repositorio.
3. Entra en **Settings > Pages**.
4. En **Build and deployment**, elige **Deploy from a branch**.
5. Selecciona la rama `main` y la carpeta `/root`.
6. Guarda.

La web quedará publicada en una URL similar a:

```text
https://tu-usuario.github.io/nombre-del-repositorio/
```

## Cambiar las respuestas públicas

Para cambiar las correcciones de la web pública, edita este archivo:

```text
data/respuestas.json
```

Después haz commit en GitHub. GitHub Pages republicará la web.

## Formato JSON recomendado

```json
{
  "titulo": "C1-04-03",
  "opciones": ["A", "B", "C", "D"],
  "penalizacion": 0.3333333333333333,
  "preguntas": [
    {
      "numero": 1,
      "ChatGPT": "A",
      "Gemini": "A",
      "ConsigueTuOpo": "A"
    }
  ]
}
```

Puedes añadir más plataformas creando nuevas columnas/campos en cada pregunta:

```json
{
  "numero": 1,
  "ChatGPT": "A",
  "Gemini": "A",
  "ConsigueTuOpo": "A",
  "OtraPlataforma": "B"
}
```

La web detecta automáticamente las plataformas.

## Formato CSV recomendado

```csv
numero,ChatGPT,Gemini,ConsigueTuOpo
1,A,A,A
2,A,A,A
3,A,A,A
```

El CSV incluido en `data/respuestas.csv` es una copia de las respuestas importadas desde el Excel.
