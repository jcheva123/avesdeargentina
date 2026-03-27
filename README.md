# Prototipo — Aves de Argentina

Este boceto está pensado para convertirse en una subpágina estática, por ejemplo:

`https://primateled.pages.dev/avesdeargentina`

## Qué resuelve este prototipo

- Navegación por **familias de aves**.
- Visualización clara del **nombre común** arriba y el **nombre científico** abajo.
- Respeto del **orden original** de carpetas y especies.
- Exclusión de la **primera imagen-ficha** como imagen principal inicial.
- **Buscador** por familia o especie.
- **Slideshow** automático.
- Diseño orientado a público general, pero sin perder rigor de clasificación.

## Estructura de datos esperada

La web se alimenta de un archivo JSON como este:

```json
{
  "families": [
    {
      "order": 3,
      "folderName": "3-tinamidae PERDICES",
      "species": [
        {
          "order": 1,
          "rawName": "3x-TINAMU HERRUMBROSO Crypturellus brevirostris.jpg",
          "photos": [
            { "order": 1, "url": "...", "isReferenceSheet": true },
            { "order": 2, "url": "..." },
            { "order": 3, "url": "..." }
          ]
        }
      ]
    }
  ]
}
```

## Regla importante

La primera imagen (`isReferenceSheet: true`) se conserva en los datos, pero el visor usa primero la **segunda imagen**, que ya sería una fotografía real del ave.

## Cómo adaptarlo al material real

### Opción recomendada
Generar un `manifest.json` desde Google Drive o desde una copia local exportada, manteniendo:

- número de familia
- nombre científico de la familia
- nombre común de la familia
- número de especie dentro de la familia
- nombre común de la especie
- nombre científico de la especie
- listado ordenado de imágenes
- marca de cuál es la ficha del libro

### Ruta simple para la primera versión
1. Descargar o duplicar parte de la colección.
2. Subir las imágenes optimizadas a una carpeta pública o al mismo proyecto.
3. Completar `data/manifest.sample.json` con URLs reales.
4. Renombrarlo como `manifest.json` si querés separar demo y producción.
5. En `app.js`, cambiar `MANIFEST_URL` si usás otro nombre.

## Sugerencia de crecimiento posterior

- vista “mosaico” por familia
- filtro alfabético
- ficha ampliada por especie
- modo “presentación museo” a pantalla completa
- integración con metadatos o geografía
- botón “ver ficha del libro” opcional

## Nota técnica sobre Google Drive

Para una integración estable, lo más práctico no suele ser leer directamente la carpeta pública desde el frontend, sino construir un listado estructurado (manifest) y consumirlo desde la web. Google Drive API permite listar archivos y buscar contenidos de carpetas mediante `files.list`, y admite consultas por carpetas/padres y campos específicos. citeturn772828search0turn772828search1
