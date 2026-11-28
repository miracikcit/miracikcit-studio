#!/bin/bash
# Pasang enjin Carousel dalam Mac mini (sekali sahaja, ~5 minit, ~600 MB):
#   bash ~/MiracikcitTranscribe/carousel_setup.sh
# Buat venv sendiri (carousel_env) supaya worker utama tak terusik, pasang Pillow, OpenCV, rembg,
# dan muat turun model buang latar (u2net_human_seg, 176 MB) ke ~/.u2net.
set -e
cd "$(dirname "$0")"
PY=""
for c in /opt/homebrew/bin/python3.12 /opt/homebrew/bin/python3.11 /opt/homebrew/bin/python3.13 /usr/local/bin/python3.12 /usr/local/bin/python3.11 python3; do
  if command -v "$c" >/dev/null 2>&1 && "$c" -c 'import sys; sys.exit(0 if sys.version_info >= (3, 10) else 1)'; then PY="$c"; break; fi
done
if [ -z "$PY" ]; then echo "Perlu Python 3.10 atau lebih baru. Pasang: brew install python@3.12"; exit 1; fi
echo "Guna $($PY --version)"
[ -d carousel_env ] || "$PY" -m venv carousel_env
carousel_env/bin/pip install -q --upgrade pip
carousel_env/bin/pip install -q Pillow numpy "opencv-python-headless<5" "rembg[cpu]"
carousel_env/bin/python -c "from rembg import new_session; new_session('u2net_human_seg'); print('Model sedia')"
carousel_env/bin/python -c "import cv2; assert hasattr(cv2, 'CascadeClassifier'); print('OpenCV', cv2.__version__)"
echo "Carousel sedia. Worker akan guna carousel_env/bin/python secara automatik."
