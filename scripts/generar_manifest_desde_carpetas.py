#!/usr/bin/env python3
"""
Genera un manifest JSON para la galería Aves de Argentina a partir de una copia local
ordenada por carpetas de familia.

Supuestos razonables del script:
- Cada carpeta de familia se llama similar a: `3-tinamidae PERDICES`
- Los archivos dentro de cada carpeta están ordenados por nombre y mantienen el orden del libro.
- Las imágenes de una misma especie comparten el mismo prefijo antes del primer guion,
  o bien el mismo bloque de nombre común/científico.
- La primera imagen detectada para cada especie se marca como `isReferenceSheet: true`.

Uso:
    python generar_manifest_desde_carpetas.py "C:/ruta/AVES FOTOS FAMILIAS" \
      --output manifest.json \
      --base-url ./imagenes

Luego:
- copiar imágenes al sitio respetando subcarpetas
- colocar el manifest generado en `data/manifest.json`
- actualizar en app.js la constante MANIFEST_URL si hace falta
"""

from __future__ import annotations

import argparse
import json
import os
import re
from pathlib import Path
from typing import Dict, List, Tuple

IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".avif", ".gif"}


def natural_key(text: str):
    return [int(part) if part.isdigit() else part.lower() for part in re.split(r"(\d+)", text)]


def parse_folder_name(folder_name: str) -> Tuple[int | None, str, str]:
    cleaned = folder_name.strip().replace("_", " ")
    match = re.match(r"^(\d+)[-_]?([a-záéíóúüñ-]+)\s+(.+)$", cleaned, re.IGNORECASE)
    if not match:
        return None, "", cleaned.upper()
    order = int(match.group(1))
    scientific = match.group(2).replace("-", " ").title()
    common = match.group(3).strip().upper()
    return order, scientific, common


def parse_species_name(raw_name: str) -> Tuple[str, str]:
    no_ext = re.sub(r"\.[a-z0-9]+$", "", raw_name, flags=re.IGNORECASE).strip()
    without_prefix = no_ext.split("-", 1)[1].strip() if "-" in no_ext else no_ext
    tokens = without_prefix.split()
    if not tokens:
        return "", ""

    scientific_start = None
    for idx, token in enumerate(tokens):
        if re.search(r"[a-záéíóúüñ]", token):
            scientific_start = idx
            break

    if scientific_start is None:
        common = " ".join(tokens).upper().strip()
        scientific = ""
    else:
        common = " ".join(tokens[:scientific_start]).upper().strip()
        scientific = " ".join(tokens[scientific_start:]).strip()

    return common, scientific


def species_group_key(filename: str) -> str:
    stem = Path(filename).stem
    prefix = stem.split("-", 1)[0].strip().lower() if "-" in stem else ""
    common, scientific = parse_species_name(filename)
    scientific_norm = re.sub(r"\s+", " ", scientific.lower()).strip()
    common_norm = re.sub(r"\s+", " ", common.lower()).strip()
    return prefix or f"{common_norm}|{scientific_norm}"


def build_manifest(root: Path, base_url: str) -> Dict:
    families: List[Dict] = []
    family_dirs = [p for p in root.iterdir() if p.is_dir()]
    family_dirs.sort(key=lambda p: natural_key(p.name))

    for family_dir in family_dirs:
        family_order, family_scientific, family_common = parse_folder_name(family_dir.name)
        image_files = [p for p in family_dir.iterdir() if p.is_file() and p.suffix.lower() in IMAGE_EXTS]
        image_files.sort(key=lambda p: natural_key(p.name))

        grouped: Dict[str, List[Path]] = {}
        species_labels: Dict[str, Tuple[str, str]] = {}
        species_orders: Dict[str, int] = {}

        current_order = 1
        for img in image_files:
            key = species_group_key(img.name)
            grouped.setdefault(key, []).append(img)
            species_labels.setdefault(key, parse_species_name(img.name))
            if key not in species_orders:
                species_orders[key] = current_order
                current_order += 1

        species_list = []
        for key, files in sorted(grouped.items(), key=lambda item: species_orders[item[0]]):
            common, scientific = species_labels[key]
            photos = []
            for idx, img in enumerate(files, start=1):
                rel = img.relative_to(root).as_posix()
                url = f"{base_url.rstrip('/')}/{rel}"
                photos.append(
                    {
                        "order": idx,
                        "url": url,
                        "isReferenceSheet": idx == 1,
                    }
                )
            species_list.append(
                {
                    "order": species_orders[key],
                    "rawName": files[0].name,
                    "commonName": common,
                    "scientificName": scientific,
                    "photos": photos,
                }
            )

        families.append(
            {
                "order": family_order or len(families) + 1,
                "folderName": family_dir.name,
                "scientificName": family_scientific,
                "commonName": family_common,
                "species": species_list,
            }
        )

    return {
        "siteTitle": "Aves de Argentina",
        "source": "Manifest generado automáticamente desde carpetas locales",
        "families": families,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("root", help="Ruta raíz donde están las carpetas de familias")
    parser.add_argument("--output", default="manifest.json", help="Archivo JSON de salida")
    parser.add_argument(
        "--base-url",
        default="./imagenes",
        help="Base URL pública donde quedarán accesibles las imágenes (por defecto: ./imagenes)",
    )
    args = parser.parse_args()

    root = Path(args.root)
    if not root.exists() or not root.is_dir():
        raise SystemExit(f"No existe la carpeta raíz: {root}")

    manifest = build_manifest(root, args.base_url)
    output = Path(args.output)
    output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"Manifest generado: {output.resolve()}")
    print(f"Familias detectadas: {len(manifest['families'])}")
    print(
        "Importante: revisá el agrupamiento de especies si en tu colección hay varias fotos con prefijos distintos para una misma ave."
    )


if __name__ == "__main__":
    main()
